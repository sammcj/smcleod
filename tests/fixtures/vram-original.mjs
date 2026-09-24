// Verbatim extract of the non-UI code (lines 1-542) from the retired React estimator, assets/js/vram-calculator.js.
// tests/vram.test.mjs compares the vanilla port in assets/js/vram/ against it. Do not edit it to match the port.
const CUDA_SIZE = 500 * 1024 * 1024; // 500 MB base CUDA overhead
const COMPUTE_BUFFER_SIZE = 1024 * 1024 * 1024; // ~1 GiB llama.cpp compute buffer allowance
// llama.cpp runs MTP as its own full-context llama_context; beyond the MTP
// layer's weights and KV, the duplicated embeddings and compute buffers
// measured ~2 GiB on a 27B (PR #22673: 2.49 GiB total at 10k ctx).
const MTP_OVERHEAD_SIZE = 2 * 1024 * 1024 * 1024;

// Bytes per KV cache element. llama.cpp quantised cache types carry a per-block
// scale: q8_0 = 34 bytes / 32 elements (8.5 bpw), q4_0 = 18 / 32 (4.5 bpw).
const KV_CACHE_BYTES = { 'FP16': 2.0, 'Q8_0': 1.0625, 'Q4_0': 0.5625 };

// Representative current-generation architectures used when no GGUF is loaded.
// kvElemsPerToken = 2 (K+V) * n_kv_heads * head_dim per layer; nearly all
// current dense/GQA models converge on 8 KV heads at head_dim 128 (= 2048).
const ARCH_PRESETS = [
  [1.5, { layers: 28, kvElemsPerToken: 2048 }], // Qwen3-1.7B
  [4, { layers: 36, kvElemsPerToken: 2048 }],   // Qwen3-4B
  [8, { layers: 36, kvElemsPerToken: 2048 }],   // Qwen3-8B / Llama 3.1 8B
  [14, { layers: 40, kvElemsPerToken: 2048 }],  // Qwen3-14B
  [24, { layers: 40, kvElemsPerToken: 2048 }],  // Mistral Small 24B
  // Qwen3.6-27B is hybrid: 64 blocks but only 16 full-attention (4 KV heads
  // × 256 head_dim); the 48 linear-attention layers hold no per-token KV.
  // `blocks` (total transformer blocks) sizes MTP weights when it differs
  // from the KV-holding layer count.
  [27, { layers: 16, kvElemsPerToken: 2048, blocks: 64 }],
  [32, { layers: 64, kvElemsPerToken: 2048 }],  // Qwen3-32B / Seed-OSS-36B
  [70, { layers: 80, kvElemsPerToken: 2048 }],  // Llama 3.x 70B / Qwen2.5-72B
  [110, { layers: 92, kvElemsPerToken: 2048 }], // GLM-4.x class
  [671, { layers: 61, kvElemsPerToken: 576 }],  // DeepSeek V3/R1 (MLA compressed KV)
];

function nearestArchPreset(numParams) {
  let best = ARCH_PRESETS[0][1];
  let bestDiff = Infinity;
  for (const [size, arch] of ARCH_PRESETS) {
    const diff = Math.abs(Math.log(numParams / size));
    if (diff < bestDiff) { bestDiff = diff; best = arch; }
  }
  return best;
}

// ===== GGUF Parsing Utilities =====
const BUFFER_SIZE = 1 << 20; // 1 MiB
const CHUNK_SIZE = 1 << 18;  // 256 KiB per range

const GGUFType = Object.freeze({
  UINT8: 0, INT8: 1, UINT16: 2, INT16: 3, UINT32: 4, INT32: 5,
  FLOAT32: 6, BOOL: 7, STRING: 8, ARRAY: 9, UINT64: 10, INT64: 11,
  FLOAT64: 12, MAX_TYPE: 13,
});

function readUIntLE(buf, offset, byteLength) {
  let val = 0n;
  for (let i = 0; i < byteLength; i++) val |= BigInt(buf[offset + i]) << BigInt(8 * i);
  return val;
}

// DataSource base class
class DataSource {
  async read(buffer, size) { throw new Error('not implemented'); }
  async seek(position) { throw new Error('not implemented'); }
  eof() { throw new Error('not implemented'); }
  tell() { throw new Error('not implemented'); }
}

// Browser File/Blob backed DataSource
class BrowserFileDataSource extends DataSource {
  constructor(file) {
    super();
    this.file = file;
    this.position = 0;
    this._eof = false;
  }
  async read(buffer, size) {
    const end = Math.min(this.position + size, this.file.size);
    const slice = this.file.slice(this.position, end);
    const arr = new Uint8Array(await slice.arrayBuffer());
    if (arr.length === 0) { this._eof = true; return false; }
    buffer.set(arr.subarray(0, size), 0);
    this.position += arr.length;
    return arr.length === size;
  }
  async seek(position) { this.position = position; this._eof = false; return true; }
  eof() { return this._eof; }
  tell() { return this.position; }
}

// URL DataSource with Range fetch and sliding buffer
class UrlDataSource extends DataSource {
  constructor(url, { verbose = false } = {}) {
    super();
    this.url = url;
    this.verbose = verbose;
    this.currentPos = 0;
    this._eof = false;
    this.abortDownload = false;
    this.downloadedData = new Uint8Array(BUFFER_SIZE);
    this.bufferSize = 0;
    this.bufferPos = 0;
  }
  async _fetchRange(start, endExclusive) {
    if (this.abortDownload) return new Uint8Array(0);
    const endInclusive = endExclusive - 1;
    const res = await fetch(this.url, { headers: { Range: `bytes=${start}-${endInclusive}` } });
    if (!res.ok && res.status !== 206 && res.status !== 200) throw new Error(`HTTP error ${res.status}`);
    const arr = new Uint8Array(await res.arrayBuffer());
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
        this.downloadedData.copyWithin(0, this.bufferPos, this.bufferSize);
        this.bufferSize -= this.bufferPos; this.bufferPos = 0;
      }
      const wantStart = this.currentPos + this.bufferSize;
      const chunkEnd = wantStart + CHUNK_SIZE;
      const neededCapacity = this.bufferSize + CHUNK_SIZE;
      if (neededCapacity > this.downloadedData.length) {
        const newBuf = new Uint8Array(Math.max(this.downloadedData.length * 2, neededCapacity));
        newBuf.set(this.downloadedData.subarray(0, this.bufferSize), 0);
        this.downloadedData = newBuf;
      }
      if (this.abortDownload) { this._eof = true; return false; }
      const arr = await this._fetchRange(wantStart, chunkEnd);
      if (arr.length === 0) { this._eof = true; return false; }
      this.downloadedData.set(arr, this.bufferSize);
      this.bufferSize += arr.length;
    }
    const copySize = Math.min(size, this.bufferSize - this.bufferPos);
    buffer.set(this.downloadedData.subarray(this.bufferPos, this.bufferPos + copySize), 0);
    this.bufferPos += copySize;
    this.currentPos += copySize;
    return copySize === size;
  }
  async seek(position) {
    if (position >= this.currentPos - this.bufferPos && position < this.currentPos + (this.bufferSize - this.bufferPos)) {
      this.bufferPos = position - (this.currentPos - this.bufferPos);
      this.currentPos = position; return true;
    }
    this.bufferSize = 0; this.bufferPos = 0; this.currentPos = position; this._eof = false; return true;
  }
  eof() { return this._eof; }
  tell() { return this.currentPos; }
  setAbortFlag() { this.abortDownload = true; }
}

async function readExact(source, size) {
  const buf = new Uint8Array(size);
  const ok = await source.read(buf, size);
  if (!ok) throw new Error('Failed to read required bytes');
  return buf;
}

async function readU32(source) {
  const b = await readExact(source, 4);
  return Number(readUIntLE(b, 0, 4));
}

async function readU64(source) {
  const b = await readExact(source, 8);
  return Number(readUIntLE(b, 0, 8));
}

async function readString(source) {
  const len = await readU64(source);
  if (len > 1024 * 1024) throw new Error(`String too long: ${len}`);
  const data = len > 0 ? await readExact(source, Number(len)) : new Uint8Array();
  return new TextDecoder().decode(data);
}

async function skipArray(source, elemType) {
  const count = await readU64(source);
  if (count > 1000000) throw new Error(`Array count too large: ${count}`);
  for (let i = 0; i < Number(count); i++) await skipValue(source, elemType);
}

async function skipValue(source, type) {
  switch (type) {
    case GGUFType.UINT8:
    case GGUFType.INT8:
      await source.seek(source.tell() + 1); break;
    case GGUFType.UINT16:
    case GGUFType.INT16:
      await source.seek(source.tell() + 2); break;
    case GGUFType.UINT32:
    case GGUFType.INT32:
    case GGUFType.FLOAT32:
      await source.seek(source.tell() + 4); break;
    case GGUFType.BOOL:
      await source.seek(source.tell() + 1); break;
    case GGUFType.STRING: {
      const length = await readU64(source);
      if (length > 1024 * 1024) throw new Error(`String too long: ${length}`);
      await source.seek(source.tell() + Number(length));
      break;
    }
    case GGUFType.ARRAY: {
      const elemTypeVal = await readU32(source);
      if (elemTypeVal >= GGUFType.MAX_TYPE) throw new Error(`Invalid array element type: ${elemTypeVal}`);
      await skipArray(source, elemTypeVal);
      break;
    }
    case GGUFType.UINT64:
    case GGUFType.INT64:
    case GGUFType.FLOAT64:
      await source.seek(source.tell() + 8); break;
    default:
      throw new Error(`Unknown GGUF type: ${type}`);
  }
}

function parseSplitInfoFromUrl(url) {
  const re = /-(\d{2,})-of-(\d{2,})(?=\.|$)/;
  const m = url.match(re);
  if (!m) return null;
  const idxStr = m[1];
  const totalStr = m[2];
  const width = idxStr.length;
  const index = Number(idxStr);
  const total = Number(totalStr);
  if (!Number.isFinite(index) || !Number.isFinite(total) || total <= 0) return null;
  return { index, total, width, patternRe: re };
}

function buildSplitUrlFrom(url, newIndex, width) {
  const idxStr = String(newIndex).padStart(width, '0');
  return url.replace(/-(\d{2,})-of-(\d{2,})(?=\.|$)/, `-${idxStr}-of-$2`);
}

async function readModelParams(pathOrFile, { verbose = false } = {}) {
  const isUrl = typeof pathOrFile === 'string';
  let source;
  if (isUrl) {
    let metaUrl = pathOrFile;
    const info = parseSplitInfoFromUrl(metaUrl);
    if (info && info.index > 1) {
      metaUrl = buildSplitUrlFrom(metaUrl, 1, info.width);
    }
    source = new UrlDataSource(metaUrl, { verbose });
  } else {
    source = new BrowserFileDataSource(pathOrFile);
  }

  const magic = await readU32(source);
  if (magic !== 0x46554747) return null;

  const version = await readU32(source);
  if (version > 3) return null;

  let tensorCount = 0;
  if (version >= 1) tensorCount = Number(await readU64(source));

  const metadataCount = Number(await readU64(source));

  const suffixes = [
    '.attention.head_count',
    '.attention.head_count_kv',
    '.attention.key_length',
    '.attention.sliding_window',
    '.attention.sliding_window_pattern',
    '.block_count',
    '.embedding_length',
    '.full_attention_interval',
    '.nextn_predict_layers',
    'split.count',
  ];

  const params = {};
  const found = { attention_heads: false, kv_heads: false, key_length: false, hidden_layers: false, hidden_size: false, split_count: false };

  for (let i = 0; i < metadataCount && !source.eof(); i++) {
    let key;
    try { key = await readString(source); } catch (e) { throw new Error(`Failed to read key: ${e.message}`); }

    // Architecture keys always precede tokenizer data; bail before skipping
    // through megabytes of vocab if we already have the essentials.
    if (key.startsWith('tokenizer.') && found.attention_heads && found.hidden_layers && found.hidden_size) {
      if (isUrl) { source.setAbortFlag?.(); }
      break;
    }

    const typeVal = await readU32(source);
    if (typeVal >= GGUFType.MAX_TYPE) throw new Error(`Invalid metadata type: ${typeVal} for key: ${key}`);
    const type = typeVal;

    const matchedSuffix = suffixes.find(s => key.endsWith(s));
    if (key === 'general.architecture' && type === GGUFType.STRING) {
      params.architecture = await readString(source);
    } else if (matchedSuffix) {
      if (matchedSuffix === '.attention.head_count' && (type === GGUFType.UINT32 || type === GGUFType.INT32)) {
        const value = await readU32(source); params.attention_heads = value; found.attention_heads = true;
      } else if (matchedSuffix === '.attention.head_count_kv') {
        if (type === GGUFType.UINT32 || type === GGUFType.INT32) {
          const value = await readU32(source); params.kv_heads = value; found.kv_heads = true;
        } else if (type === GGUFType.ARRAY) {
          // Per-layer KV head counts; 0 entries are layers with no KV cache.
          const elemType = await readU32(source);
          const count = Number(await readU64(source));
          if ((elemType === GGUFType.UINT32 || elemType === GGUFType.INT32) && count > 0 && count <= 4096) {
            const arr = [];
            for (let j = 0; j < count; j++) arr.push(await readU32(source));
            params.kv_heads_array = arr;
            params.kv_heads = arr.reduce((a, b) => Math.max(a, b), 0);
            found.kv_heads = true;
          } else {
            for (let j = 0; j < count; j++) await skipValue(source, elemType);
          }
        } else { await skipValue(source, type); }
      } else if (matchedSuffix === '.attention.sliding_window' && (type === GGUFType.UINT32 || type === GGUFType.INT32)) {
        params.sliding_window = await readU32(source);
      } else if (matchedSuffix === '.attention.sliding_window_pattern') {
        if (type === GGUFType.UINT32 || type === GGUFType.INT32) {
          params.swa_pattern_interval = await readU32(source);
        } else if (type === GGUFType.ARRAY) {
          // Bool per layer, true = sliding-window attention.
          const elemType = await readU32(source);
          const count = Number(await readU64(source));
          if (elemType === GGUFType.BOOL && count > 0 && count <= 4096) {
            const bytes = await readExact(source, count);
            params.swa_layers = Array.from(bytes).filter(b => b !== 0).length;
          } else {
            for (let j = 0; j < count; j++) await skipValue(source, elemType);
          }
        } else { await skipValue(source, type); }
      } else if (matchedSuffix === '.full_attention_interval' && (type === GGUFType.UINT32 || type === GGUFType.INT32)) {
        params.full_attention_interval = await readU32(source);
      } else if (matchedSuffix === '.attention.key_length' && (type === GGUFType.UINT32 || type === GGUFType.INT32)) {
        const value = await readU32(source); params.key_length = value; found.key_length = true;
      } else if (matchedSuffix === '.nextn_predict_layers' && (type === GGUFType.UINT32 || type === GGUFType.INT32)) {
        const value = await readU32(source); params.nextn_layers = value;
      } else if (matchedSuffix === '.block_count' && (type === GGUFType.UINT32 || type === GGUFType.INT32)) {
        const value = await readU32(source); params.hidden_layers = value; found.hidden_layers = true;
      } else if (matchedSuffix === '.embedding_length') {
        if (type === GGUFType.UINT64 || type === GGUFType.INT64) {
          const value = await readU64(source); params.hidden_size = value; found.hidden_size = true;
        } else if (type === GGUFType.UINT32 || type === GGUFType.INT32) {
          const value = await readU32(source); params.hidden_size = value; found.hidden_size = true;
        } else { await skipValue(source, type); }
      } else if (matchedSuffix === 'split.count') {
        if (type === GGUFType.UINT64 || type === GGUFType.INT64) {
          const value = await readU64(source); params.split_count = value; found.split_count = true;
        } else if (type === GGUFType.UINT32 || type === GGUFType.INT32) {
          const value = await readU32(source); params.split_count = value; found.split_count = true;
        } else { await skipValue(source, type); }
      } else { await skipValue(source, type); }
    } else { await skipValue(source, type); }

    // No early break on "all found" — optional keys like nextn_predict_layers
    // can appear anywhere in the arch section; the tokenizer bail above stops
    // us before the expensive vocab arrays regardless.
  }

  if (!found.kv_heads && found.attention_heads) { params.kv_heads = params.attention_heads; found.kv_heads = true; }

  const allFound = found.attention_heads && found.hidden_layers && found.hidden_size;
  if (!allFound) return null;
  return params;
}

async function getRemoteFileSize(url, { verbose = false } = {}) {
  try {
    const head = await fetch(url, { method: 'HEAD' });
    if (head.ok) {
      const cl = head.headers.get('content-length');
      if (cl) {
        const n = Number(cl);
        if (Number.isFinite(n) && n > 0) return n;
      }
    }
  } catch (e) { }
  try {
    const res = await fetch(url, { headers: { Range: 'bytes=0-0' } });
    if (!res.ok && res.status !== 206 && res.status !== 200) return 0;
    const cr = res.headers.get('content-range');
    if (cr) {
      const m = cr.match(/\/(\d+)$/);
      if (m) {
        const n = Number(m[1]);
        if (Number.isFinite(n) && n > 0) return n;
      }
    }
    const cl = res.headers.get('content-length');
    if (cl) {
      const n = Number(cl);
      if (Number.isFinite(n) && n > 0) return n;
    }
  } catch (e) { }
  return 0;
}

async function totalSplitSizeFromUrl(url, params, { verbose = false } = {}) {
  const info = parseSplitInfoFromUrl(url);
  const total = params?.split_count && params.split_count > 1 ? params.split_count : (info?.total || 0);
  if (!total || total <= 1) return null;
  const width = info?.width || 5;
  const partUrls = [];
  if (info) {
    for (let i = 1; i <= total; i++) partUrls.push(buildSplitUrlFrom(url, i, width));
  } else {
    const extIdx = url.lastIndexOf('.');
    const base = extIdx > -1 ? url.slice(0, extIdx) : url;
    const ext = extIdx > -1 ? url.slice(extIdx) : '';
    for (let i = 1; i <= total; i++) {
      const idxStr = String(i).padStart(width, '0');
      partUrls.push(`${base}-${idxStr}-of-${String(total).padStart(width, '0')}${ext}`);
    }
  }
  const sizes = await Promise.all(partUrls.map(u => getRemoteFileSize(u, { verbose })));
  if (sizes.some(s => !s || s <= 0)) return null;
  const totalBytes = sizes.reduce((a, b) => a + b, 0);
  return totalBytes;
}

function normalizeHuggingFaceUrl(u) {
  if (!u || typeof u !== 'string') return u;
  try {
    if (!u.includes('huggingface.co/')) return u;
    let updated = u.replace(/\/blob\//, '/resolve/');
    updated = updated.replace(/\?raw=1|\?download=1|\?raw=true/i, '');
    if (!/\.gguf($|[?#])/.test(updated)) return u;
    return updated;
  } catch { return u; }
}

function extractQuantizationFromFilename(filename) {
  if (!filename) return null;

  // Quantization format mapping to bpw values
  // Order matters - check more specific patterns first (e.g., Q5_K_XL before Q5_K_L)
  const quantMap = {
    'F16': 16.00, 'FP16': 16.00,
    'Q8_0': 8.50,
    'Q6_K': 6.57,
    'Q5_K_XL': 6.15, 'Q5_K_L': 5.90, 'Q5_K_M': 5.67, 'Q5_K_S': 5.52,
    'Q4_K_XL': 5.45, 'Q4_K_L': 5.15, 'Q4_K_M': 4.83, 'Q4_K_S': 4.57,
    'IQ4_NL': 4.56, 'IQ4_XS': 4.32,
    'Q3_K_XL': 4.50, 'Q3_K_L': 4.22, 'Q3_K_M': 3.89, 'Q3_K_S': 3.50,
    'IQ3_M': 3.63, 'IQ3_S': 3.52, 'IQ3_XXS': 3.21, 'IQ3_XS': 3.32,
    'Q4_0': 4.00,
    'Q2_K_S': 2.79, 'Q2_K': 3.00,
    'IQ2_XXS': 2.20, 'IQ2_XS': 2.43, 'IQ2_S': 2.55, 'IQ2_M': 2.76,
    'IQ1_S': 1.78
  };

  // Try to match quantization pattern in filename
  const upperFilename = filename.toUpperCase();
  for (const [pattern, bpw] of Object.entries(quantMap)) {
    if (upperFilename.includes(pattern)) {
      return bpw;
    }
  }

  return null;
}

// Total KV cache elements for a GGUF-described model, accounting for hybrid
// attention layouts: per-layer KV head arrays (0 = no KV on that layer),
// sliding-window layers capped at their window, and linear-attention layers
// (full_attention_interval) that hold no per-token KV at all.
function ggufKvElements(meta, contextSize) {
  const layers = meta.hidden_layers;
  const headDim = meta.key_length || Math.round(meta.hidden_size / meta.attention_heads);

  if (Array.isArray(meta.kv_heads_array)) {
    const headSum = meta.kv_heads_array.reduce((a, b) => a + b, 0);
    return contextSize * 2 * headDim * headSum;
  }

  const perLayer = 2 * meta.kv_heads * headDim;

  // llama.cpp hardcodes Gemma 3's 5 local : 1 global pattern (every 6th layer
  // is global); Gemma 3n/4 and gpt-oss write the pattern to metadata instead.
  const pattern = meta.swa_pattern_interval ||
    (meta.architecture === 'gemma3' ? 6 : 0);
  if (meta.sliding_window > 0 && (meta.swa_layers != null || pattern > 1)) {
    const swaLayers = meta.swa_layers != null
      ? meta.swa_layers
      : layers - Math.floor(layers / pattern);
    const fullLayers = layers - swaLayers;
    return (contextSize * fullLayers + Math.min(contextSize, meta.sliding_window) * swaLayers) * perLayer;
  }

  if (meta.full_attention_interval > 1) {
    // floor() also absorbs MTP-inflated block counts on qwen35-style GGUFs.
    return contextSize * Math.floor(layers / meta.full_attention_interval) * perLayer;
  }

  return contextSize * layers * perLayer;
}

const calculateMemoryBreakdown = (config, ggufMetadata = null, draftMetadata = null) => {
  const { numParams, contextSize, bitsPerWeight, kvCacheType, mtpEnabled } = config;
  const bytesPerElement = KV_CACHE_BYTES[kvCacheType] || 2.0;

  let baseModelSize, totalBlocks, kvCacheSize, mtpKvElemsPerToken;

  if (ggufMetadata) {
    baseModelSize = ggufMetadata.modelSizeBytes || (numParams * 1e9 * bitsPerWeight) / 8;
    totalBlocks = ggufMetadata.hidden_layers;
    kvCacheSize = ggufKvElements(ggufMetadata, contextSize) * bytesPerElement;
    // head_dim often differs from hidden/heads (e.g. Qwen3-32B: 5120/64 = 80
    // but head_dim is 128), so prefer key_length.
    const headDim = ggufMetadata.key_length ||
      Math.round(ggufMetadata.hidden_size / ggufMetadata.attention_heads);
    mtpKvElemsPerToken = 2 * ggufMetadata.kv_heads * headDim;
  } else {
    baseModelSize = (numParams * 1e9 * bitsPerWeight) / 8;
    const arch = nearestArchPreset(numParams);
    totalBlocks = arch.blocks || arch.layers;
    kvCacheSize = contextSize * arch.layers * arch.kvElemsPerToken * bytesPerElement;
    mtpKvElemsPerToken = arch.kvElemsPerToken;
  }

  // MTP (nextn) modules are standard full-attention blocks with their own KV
  // cache. GGUF file sizes already include their weights; formula mode adds
  // one block's worth of parameters.
  if (mtpEnabled) {
    const mtpLayers = ggufMetadata ? (ggufMetadata.nextn_layers || 0) : 1;
    if (mtpLayers > 0) {
      kvCacheSize += contextSize * mtpLayers * mtpKvElemsPerToken * bytesPerElement;
      baseModelSize += MTP_OVERHEAD_SIZE;
      if (!ggufMetadata) baseModelSize += baseModelSize / totalBlocks;
    }
  }

  // DFlash-style speculative decoding uses a separate small draft model with
  // its own weights and KV cache.
  if (draftMetadata) {
    kvCacheSize += ggufKvElements(draftMetadata, contextSize) * bytesPerElement;
    baseModelSize += draftMetadata.modelSizeBytes || 0;
  }

  return {
    modelSize: (baseModelSize + CUDA_SIZE + COMPUTE_BUFFER_SIZE) / (1024 * 1024 * 1024),
    kvCacheSize: kvCacheSize / (1024 * 1024 * 1024)
  };
};

export { CUDA_SIZE, COMPUTE_BUFFER_SIZE, MTP_OVERHEAD_SIZE, KV_CACHE_BYTES, nearestArchPreset, readModelParams, getRemoteFileSize, totalSplitSizeFromUrl, parseSplitInfoFromUrl, buildSplitUrlFrom, normalizeHuggingFaceUrl, extractQuantizationFromFilename, ggufKvElements, calculateMemoryBreakdown };
