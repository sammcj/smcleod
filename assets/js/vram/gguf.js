// GGUF header reader: pulls the architecture metadata the estimator needs from a local File/Blob or a URL,
// fetching only the header over HTTP Range requests.
import { parseSplitInfoFromUrl, buildSplitUrlFrom, splitPartUrls } from './calc.js';

const BUFFER_SIZE = 1 << 20; // 1 MiB
const CHUNK_SIZE = 1 << 18; // 256 KiB per range

const T = Object.freeze({
  UINT8: 0, INT8: 1, UINT16: 2, INT16: 3, UINT32: 4, INT32: 5,
  FLOAT32: 6, BOOL: 7, STRING: 8, ARRAY: 9, UINT64: 10, INT64: 11,
  FLOAT64: 12, MAX_TYPE: 13,
});
const FIXED_SIZE = { 0: 1, 1: 1, 2: 2, 3: 2, 4: 4, 5: 4, 6: 4, 7: 1, 10: 8, 11: 8, 12: 8 };
const isInt32 = t => t === T.UINT32 || t === T.INT32;
const isInt64 = t => t === T.UINT64 || t === T.INT64;

function readUIntLE(buf, offset, byteLength) {
  let val = 0n;
  for (let i = 0; i < byteLength; i++) val |= BigInt(buf[offset + i]) << BigInt(8 * i);
  return val;
}

class BlobSource {
  constructor(blob) { this.blob = blob; this.position = 0; this._eof = false; }
  async read(buffer, size) {
    const end = Math.min(this.position + size, this.blob.size);
    const arr = new Uint8Array(await this.blob.slice(this.position, end).arrayBuffer());
    if (arr.length === 0) { this._eof = true; return false; }
    buffer.set(arr.subarray(0, size), 0);
    this.position += arr.length;
    return arr.length === size;
  }
  async seek(position) { this.position = position; this._eof = false; }
  eof() { return this._eof; }
  tell() { return this.position; }
}

// Range-fetching source with a sliding buffer, so small sequential reads cost one request per chunk
class UrlSource {
  constructor(url) {
    this.url = url;
    this.currentPos = 0;
    this._eof = false;
    this.aborted = false;
    this.data = new Uint8Array(BUFFER_SIZE);
    this.bufferSize = 0;
    this.bufferPos = 0;
  }
  async fetchRange(start, endExclusive) {
    if (this.aborted) return new Uint8Array(0);
    const res = await fetch(this.url, { headers: { Range: `bytes=${start}-${endExclusive - 1}` } });
    if (!res.ok && res.status !== 206 && res.status !== 200) throw new Error(`HTTP error ${res.status}`);
    const arr = new Uint8Array(await res.arrayBuffer());
    // a server that ignores Range sends the whole file
    if (res.status === 200 && start > 0) {
      if (arr.length <= start) return new Uint8Array(0);
      return arr.subarray(start, Math.min(arr.length, endExclusive));
    }
    return arr;
  }
  async read(buffer, size) {
    while (this.bufferPos + size > this.bufferSize) {
      if (this.bufferPos >= this.bufferSize) { this.bufferSize = 0; this.bufferPos = 0; }
      if (this.bufferPos > 0 && this.bufferSize > this.bufferPos) {
        this.data.copyWithin(0, this.bufferPos, this.bufferSize);
        this.bufferSize -= this.bufferPos; this.bufferPos = 0;
      }
      const wantStart = this.currentPos + this.bufferSize;
      const needed = this.bufferSize + CHUNK_SIZE;
      if (needed > this.data.length) {
        const bigger = new Uint8Array(Math.max(this.data.length * 2, needed));
        bigger.set(this.data.subarray(0, this.bufferSize), 0);
        this.data = bigger;
      }
      if (this.aborted) { this._eof = true; return false; }
      const arr = await this.fetchRange(wantStart, wantStart + CHUNK_SIZE);
      if (arr.length === 0) { this._eof = true; return false; }
      this.data.set(arr, this.bufferSize);
      this.bufferSize += arr.length;
    }
    const n = Math.min(size, this.bufferSize - this.bufferPos);
    buffer.set(this.data.subarray(this.bufferPos, this.bufferPos + n), 0);
    this.bufferPos += n;
    this.currentPos += n;
    return n === size;
  }
  async seek(position) {
    const bufStart = this.currentPos - this.bufferPos;
    if (position >= bufStart && position < this.currentPos + (this.bufferSize - this.bufferPos)) {
      this.bufferPos = position - bufStart;
      this.currentPos = position;
      return;
    }
    this.bufferSize = 0; this.bufferPos = 0; this.currentPos = position; this._eof = false;
  }
  eof() { return this._eof; }
  tell() { return this.currentPos; }
  abort() { this.aborted = true; }
}

async function readExact(src, size) {
  const buf = new Uint8Array(size);
  if (!(await src.read(buf, size))) throw new Error('Failed to read required bytes');
  return buf;
}
const readU32 = async src => Number(readUIntLE(await readExact(src, 4), 0, 4));
const readU64 = async src => Number(readUIntLE(await readExact(src, 8), 0, 8));

async function readString(src) {
  const len = await readU64(src);
  if (len > 1024 * 1024) throw new Error(`String too long: ${len}`);
  return new TextDecoder().decode(len > 0 ? await readExact(src, len) : new Uint8Array());
}

async function skipValue(src, type) {
  if (type in FIXED_SIZE) return src.seek(src.tell() + FIXED_SIZE[type]);
  if (type === T.STRING) {
    const len = await readU64(src);
    if (len > 1024 * 1024) throw new Error(`String too long: ${len}`);
    return src.seek(src.tell() + len);
  }
  if (type === T.ARRAY) {
    const elemType = await readU32(src);
    if (elemType >= T.MAX_TYPE) throw new Error(`Invalid array element type: ${elemType}`);
    return skipArray(src, elemType, await readU64(src));
  }
  throw new Error(`Unknown GGUF type: ${type}`);
}

// Seeking needs no read, so a crafted count on a fixed-size array would otherwise loop without ever hitting EOF
async function skipArray(src, elemType, count) {
  if (count > 1000000) throw new Error(`Array count too large: ${count}`);
  if (elemType in FIXED_SIZE) return src.seek(src.tell() + count * FIXED_SIZE[elemType]);
  for (let i = 0; i < count; i++) await skipValue(src, elemType);
}

// Reads a u32 array (<= 4096 entries) or skips it; returns null when skipped
async function readSmallArray(src, want) {
  const elemType = await readU32(src);
  const count = await readU64(src);
  if (want(elemType) && count > 0 && count <= 4096) return { elemType, count };
  await skipArray(src, elemType, count);
  return null;
}

const SUFFIXES = [
  '.attention.head_count', '.attention.head_count_kv', '.attention.key_length', '.attention.sliding_window',
  '.attention.sliding_window_pattern', '.block_count', '.embedding_length', '.full_attention_interval',
  '.nextn_predict_layers', 'split.count',
];

// Architecture metadata from a GGUF header, or null when it isn't a GGUF or lacks the essentials
export async function readModelParams(pathOrBlob) {
  const isUrl = typeof pathOrBlob === 'string';
  let src;
  if (isUrl) {
    // split models keep their metadata in part 1
    let metaUrl = pathOrBlob;
    const info = parseSplitInfoFromUrl(metaUrl);
    if (info && info.index > 1) metaUrl = buildSplitUrlFrom(metaUrl, 1, info.width);
    src = new UrlSource(metaUrl);
  } else {
    src = new BlobSource(pathOrBlob);
  }

  if ((await readU32(src)) !== 0x46554747) return null; // "GGUF"
  const version = await readU32(src);
  if (version > 3) return null;
  if (version >= 1) await readU64(src); // tensor count
  const metadataCount = await readU64(src);

  const p = {};
  const found = { attention_heads: false, kv_heads: false, hidden_layers: false, hidden_size: false };

  for (let i = 0; i < metadataCount && !src.eof(); i++) {
    let key;
    try { key = await readString(src); } catch (e) { throw new Error(`Failed to read key: ${e.message}`); }

    // Architecture keys always precede tokenizer data; bail before skipping
    // through megabytes of vocab if we already have the essentials.
    if (key.startsWith('tokenizer.') && found.attention_heads && found.hidden_layers && found.hidden_size) {
      if (isUrl) src.abort();
      break;
    }

    const type = await readU32(src);
    if (type >= T.MAX_TYPE) throw new Error(`Invalid metadata type: ${type} for key: ${key}`);
    const suffix = SUFFIXES.find(s => key.endsWith(s));

    if (key === 'general.architecture' && type === T.STRING) {
      p.architecture = await readString(src);
    } else if (suffix === '.attention.head_count' && isInt32(type)) {
      p.attention_heads = await readU32(src); found.attention_heads = true;
    } else if (suffix === '.attention.head_count_kv' && isInt32(type)) {
      p.kv_heads = await readU32(src); found.kv_heads = true;
    } else if (suffix === '.attention.head_count_kv' && type === T.ARRAY) {
      // Per-layer KV head counts; 0 entries are layers with no KV cache.
      const arr = await readSmallArray(src, isInt32);
      if (arr) {
        const heads = [];
        for (let j = 0; j < arr.count; j++) heads.push(await readU32(src));
        p.kv_heads_array = heads;
        p.kv_heads = heads.reduce((a, b) => Math.max(a, b), 0);
        found.kv_heads = true;
      }
    } else if (suffix === '.attention.sliding_window' && isInt32(type)) {
      p.sliding_window = await readU32(src);
    } else if (suffix === '.attention.sliding_window_pattern' && isInt32(type)) {
      p.swa_pattern_interval = await readU32(src);
    } else if (suffix === '.attention.sliding_window_pattern' && type === T.ARRAY) {
      // Bool per layer, true = sliding-window attention.
      const arr = await readSmallArray(src, t => t === T.BOOL);
      if (arr) p.swa_layers = Array.from(await readExact(src, arr.count)).filter(b => b !== 0).length;
    } else if (suffix === '.full_attention_interval' && isInt32(type)) {
      p.full_attention_interval = await readU32(src);
    } else if (suffix === '.attention.key_length' && isInt32(type)) {
      p.key_length = await readU32(src);
    } else if (suffix === '.nextn_predict_layers' && isInt32(type)) {
      p.nextn_layers = await readU32(src);
    } else if (suffix === '.block_count' && isInt32(type)) {
      p.hidden_layers = await readU32(src); found.hidden_layers = true;
    } else if (suffix === '.embedding_length' && (isInt32(type) || isInt64(type))) {
      p.hidden_size = isInt64(type) ? await readU64(src) : await readU32(src); found.hidden_size = true;
    } else if (suffix === 'split.count' && (isInt32(type) || isInt64(type))) {
      p.split_count = isInt64(type) ? await readU64(src) : await readU32(src);
    } else {
      await skipValue(src, type);
    }
    // No early break on "all found": optional keys like nextn_predict_layers
    // can appear anywhere in the arch section; the tokenizer bail above stops
    // us before the expensive vocab arrays regardless.
  }

  if (!found.kv_heads && found.attention_heads) p.kv_heads = p.attention_heads;
  return found.attention_heads && found.hidden_layers && found.hidden_size ? p : null;
}

// File size from a HEAD, falling back to a one-byte Range GET; 0 when unknown
export async function getRemoteFileSize(url) {
  const positive = v => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : 0; };
  try {
    const head = await fetch(url, { method: 'HEAD' });
    if (head.ok) {
      const n = positive(head.headers.get('content-length'));
      if (n) return n;
    }
  } catch { /* fall through to the Range probe */ }
  try {
    const res = await fetch(url, { headers: { Range: 'bytes=0-0' } });
    if (!res.ok && res.status !== 206 && res.status !== 200) return 0;
    const m = (res.headers.get('content-range') || '').match(/\/(\d+)$/);
    return (m && positive(m[1])) || positive(res.headers.get('content-length'));
  } catch {
    return 0;
  }
}

// Size of a model: all split parts summed when split, else the single file; 0 when unknown
export async function remoteModelSize(url, params) {
  const parts = splitPartUrls(url, params?.split_count);
  if (parts) {
    const sizes = await Promise.all(parts.map(getRemoteFileSize));
    if (sizes.every(s => s > 0)) return sizes.reduce((a, b) => a + b, 0);
  }
  return getRemoteFileSize(url);
}
