// Compares the vanilla vRAM estimator port (assets/js/vram/) with the original React build's code, extracted
// verbatim into fixtures/vram-original.mjs. Run: node --test 'tests/*.test.mjs'
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as port from '../assets/js/vram/calc.js';
import * as gguf from '../assets/js/vram/gguf.js';
import * as orig from './fixtures/vram-original.mjs';

const KV_TYPES = ['FP16', 'Q8_0', 'Q4_0'];

// Deterministic PRNG so failures reproduce
function rng(seed) {
  return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

test('constants match', () => {
  assert.equal(port.CUDA_SIZE, orig.CUDA_SIZE);
  assert.equal(port.COMPUTE_BUFFER_SIZE, orig.COMPUTE_BUFFER_SIZE);
  assert.equal(port.MTP_OVERHEAD_SIZE, orig.MTP_OVERHEAD_SIZE);
  assert.deepEqual(port.KV_CACHE_BYTES, orig.KV_CACHE_BYTES);
});

test('option lists match the original selects', () => {
  assert.deepEqual(port.MODEL_SIZES.map(o => o[0]), [1.5, 3.8, 7, 8, 14, 22, 24, 27, 32, 70, 72, 90, 110, 671]);
  assert.equal(port.MODEL_SIZES[0][1], '1.5B parameters');
  assert.deepEqual(port.CONTEXT_SIZES, [
    [4096, '4K tokens'], [8192, '8K tokens'], [16384, '16K tokens'], [32768, '32K tokens'], [49152, '48K tokens'],
    [65536, '64K tokens'], [98304, '96K tokens'], [131072, '128K tokens'], [262144, '256K tokens']]);
  assert.equal(port.QUANT_LEVELS.length, 29);
  assert.deepEqual(port.QUANT_LEVELS.slice(0, 3), [[16, 'FP16 (16.00)'], [8.5, 'Q8_0 (8.50)'], [6.57, 'Q6_K (6.57)']]);
  assert.deepEqual(port.QUANT_LEVELS.at(-1), [1.78, 'IQ1_S (1.78)']);
  assert.deepEqual(port.DEFAULT_CONFIG, { numParams: 27, contextSize: 131072, bitsPerWeight: 5.67, mtpEnabled: true });
});

test('formula mode: every preset size, context, quant, KV type and MTP setting', () => {
  let n = 0;
  for (const [numParams] of port.MODEL_SIZES) {
    for (const [contextSize] of port.CONTEXT_SIZES) {
      for (const [bitsPerWeight] of port.QUANT_LEVELS) {
        for (const kvCacheType of KV_TYPES) {
          for (const mtpEnabled of [true, false]) {
            const cfg = { numParams, contextSize, bitsPerWeight, kvCacheType, mtpEnabled };
            assert.deepEqual(port.calculateMemoryBreakdown(cfg), orig.calculateMemoryBreakdown(cfg), JSON.stringify(cfg));
            n++;
          }
        }
      }
    }
  }
  assert.equal(n, 14 * 9 * 29 * 3 * 2);
});

test('formula mode: slider values (fractional sizes, any 1K context step)', () => {
  const r = rng(42);
  for (let i = 0; i < 2000; i++) {
    const cfg = {
      numParams: Math.round((1 + r() * 670) * 10) / 10,
      contextSize: (1 + Math.floor(r() * 256)) * 1024,
      bitsPerWeight: port.QUANT_LEVELS[Math.floor(r() * port.QUANT_LEVELS.length)][0],
      kvCacheType: KV_TYPES[i % 3],
      mtpEnabled: r() > 0.5,
    };
    assert.deepEqual(port.calculateMemoryBreakdown(cfg), orig.calculateMemoryBreakdown(cfg), JSON.stringify(cfg));
  }
});

test('known value: default config, FP16 KV', () => {
  const r = port.calculateMemoryBreakdown({ ...port.DEFAULT_CONFIG, kvCacheType: 'FP16' });
  // 27B at 5.67 bpw with MTP: weights + 2 GiB MTP + one block of 64 + CUDA + compute buffer
  const base = 27e9 * 5.67 / 8 + 2 * 2 ** 30;
  assert.equal(r.modelSize, (base + base / 64 + 500 * 2 ** 20 + 2 ** 30) / 2 ** 30);
  assert.equal(r.kvCacheSize, (131072 * 16 * 2048 * 2 + 131072 * 2048 * 2) / 2 ** 30);
});

const METAS = {
  llama: { architecture: 'llama', attention_heads: 64, kv_heads: 8, hidden_layers: 80, hidden_size: 8192, key_length: 128, modelSizeBytes: 42.5e9 },
  noKeyLength: { architecture: 'llama', attention_heads: 32, kv_heads: 8, hidden_layers: 32, hidden_size: 4096, modelSizeBytes: 4.9e9 },
  noSize: { architecture: 'qwen3', attention_heads: 64, kv_heads: 8, hidden_layers: 64, hidden_size: 5120, key_length: 128, modelSizeBytes: 0 },
  kvArray: { architecture: 'x', attention_heads: 16, kv_heads: 4, kv_heads_array: [4, 0, 0, 4, 0, 0, 4, 2], hidden_layers: 8, hidden_size: 2048, key_length: 256, modelSizeBytes: 3e9 },
  gemma3: { architecture: 'gemma3', attention_heads: 32, kv_heads: 16, hidden_layers: 62, hidden_size: 5376, key_length: 128, sliding_window: 1024, modelSizeBytes: 16e9 },
  swaPattern: { architecture: 'gemma3n', attention_heads: 8, kv_heads: 2, hidden_layers: 30, hidden_size: 2048, sliding_window: 512, swa_pattern_interval: 5, modelSizeBytes: 4e9 },
  swaLayers: { architecture: 'gpt-oss', attention_heads: 64, kv_heads: 8, hidden_layers: 36, hidden_size: 2880, key_length: 64, sliding_window: 128, swa_layers: 18, modelSizeBytes: 63e9 },
  qwen35: { architecture: 'qwen35', attention_heads: 24, kv_heads: 4, hidden_layers: 65, hidden_size: 5120, key_length: 256, full_attention_interval: 4, nextn_layers: 1, modelSizeBytes: 19.8e9 },
  mtpStripped: { architecture: 'qwen35', attention_heads: 24, kv_heads: 4, hidden_layers: 64, hidden_size: 5120, key_length: 256, full_attention_interval: 4, modelSizeBytes: 19e9 },
  swaNoPattern: { architecture: 'mistral', attention_heads: 32, kv_heads: 8, hidden_layers: 32, hidden_size: 4096, sliding_window: 4096, modelSizeBytes: 7e9 },
};
const DRAFT = { architecture: 'qwen3', attention_heads: 16, kv_heads: 8, hidden_layers: 5, hidden_size: 2048, key_length: 128, modelSizeBytes: 0.9e9 };

test('GGUF mode: hybrid layouts, MTP and draft models', () => {
  for (const [name, meta] of Object.entries(METAS)) {
    for (const draft of [null, DRAFT, { ...DRAFT, modelSizeBytes: 0 }]) {
      for (const [contextSize] of port.CONTEXT_SIZES) {
        for (const kvCacheType of KV_TYPES) {
          for (const mtpEnabled of [true, false]) {
            const cfg = { numParams: 27, contextSize, bitsPerWeight: 5.67, kvCacheType, mtpEnabled };
            assert.deepEqual(port.calculateMemoryBreakdown(cfg, meta, draft), orig.calculateMemoryBreakdown(cfg, meta, draft), `${name} ${JSON.stringify(cfg)}`);
          }
        }
      }
      assert.equal(port.ggufKvElements(meta, 8192), orig.ggufKvElements(meta, 8192), name);
    }
  }
});

test('estimateAll gives the three bars and the original scale', () => {
  const cfg = { numParams: 70, contextSize: 32768, bitsPerWeight: 4.83, mtpEnabled: false };
  const { rows, maxMemory } = port.estimateAll(cfg, null, null);
  assert.deepEqual(rows.map(r => r.kvCacheType), KV_TYPES);
  for (const r of rows) {
    const o = orig.calculateMemoryBreakdown({ ...cfg, kvCacheType: r.kvCacheType });
    assert.equal(r.modelSize, o.modelSize);
    assert.equal(r.kvCacheSize, o.kvCacheSize);
  }
  assert.equal(maxMemory, Math.max(rows[0].modelSize + rows[0].kvCacheSize, 24));
  assert.equal(port.estimateAll({ ...cfg, numParams: 1.5, contextSize: 4096 }).maxMemory, 24);
});

test('arch preset lookup', () => {
  for (let p = 0.5; p < 800; p *= 1.07) assert.deepEqual(port.nearestArchPreset(p), orig.nearestArchPreset(p), String(p));
});

test('quantisation from filename', () => {
  const names = [
    'Qwen3.6-27B-UD-Q5_K_XL.gguf', 'model-Q5_K_L.gguf', 'x.Q5_K_M.gguf', 'x-q5_k_s.gguf', 'Llama-Q4_K_XL.gguf',
    'm-Q4_K_L.gguf', 'm-Q4_K_M-00001-of-00003.gguf', 'm-Q4_K_S.gguf', 'm-IQ4_NL.gguf', 'm-IQ4_XS.gguf', 'm-Q3_K_XL.gguf',
    'm-Q3_K_L.gguf', 'm-Q3_K_M.gguf', 'm-Q3_K_S.gguf', 'm-IQ3_M.gguf', 'm-IQ3_S.gguf', 'm-IQ3_XXS.gguf', 'm-IQ3_XS.gguf',
    'm-Q4_0.gguf', 'm-Q2_K_S.gguf', 'm-Q2_K.gguf', 'm-IQ2_XXS.gguf', 'm-IQ2_XS.gguf', 'm-IQ2_S.gguf', 'm-IQ2_M.gguf',
    'm-IQ1_S.gguf', 'm-F16.gguf', 'm-BF16.gguf', 'm-fp16.gguf', 'm-Q8_0.gguf', 'm-Q6_K.gguf', 'model.gguf', '', null,
  ];
  for (const n of names) assert.equal(port.extractQuantisationFromFilename(n), orig.extractQuantizationFromFilename(n), String(n));
});

test('Hugging Face URL normalising', () => {
  const urls = [
    'https://huggingface.co/a/b/blob/main/m-Q4_K_M.gguf', 'https://huggingface.co/a/b/blob/main/m.gguf?download=1',
    'https://huggingface.co/a/b/resolve/main/m.gguf', 'https://huggingface.co/a/b/blob/main/README.md',
    'https://example.com/blob/m.gguf', 'https://huggingface.co/a/b/blob/main/m.gguf?raw=true', '', null,
  ];
  for (const u of urls) assert.equal(port.normaliseHuggingFaceUrl(u), orig.normalizeHuggingFaceUrl(u), String(u));
});

test('split helpers', () => {
  for (const u of ['https://h/m-00002-of-00003.gguf', 'https://h/m-02-of-10.gguf', 'https://h/m.gguf', 'https://h/m-1-of-2.gguf']) {
    const a = port.parseSplitInfoFromUrl(u), b = orig.parseSplitInfoFromUrl(u);
    assert.deepEqual(a, b && { index: b.index, total: b.total, width: b.width }, u);
    if (a) assert.equal(port.buildSplitUrlFrom(u, 1, a.width), orig.buildSplitUrlFrom(u, 1, a.width));
  }
});

test('estimated params and local split totals match the original handlers', () => {
  const r = rng(7);
  for (let i = 0; i < 500; i++) {
    const size = Math.floor(r() * 400e9), bpw = port.QUANT_LEVELS[i % 29][0];
    assert.equal(port.estimateParams(size, bpw), Number(((size / (bpw / 8)) / 1e9).toFixed(1)));
  }
  // Inline logic from the original handleLoadFromFile
  const original = (name, size, splitCount) => {
    let totalBytes = size;
    if (splitCount && splitCount > 1) {
      const m = (name || '').match(/-(\d{2,})-of-(\d{2,})(?=\.|$)/);
      const inferredTotal = m ? Number(m[2]) : splitCount;
      if (Number.isFinite(inferredTotal) && inferredTotal > 1) totalBytes = size * inferredTotal;
    }
    return totalBytes;
  };
  for (const [name, split] of [['m-00001-of-00004.gguf', 4], ['m.gguf', 3], ['m.gguf', undefined], ['m-00001-of-00004.gguf', 1], ['', 2]]) {
    assert.equal(port.localSplitTotalBytes(name, 1234567, split), original(name, 1234567, split), `${name} ${split}`);
  }
});

// --- GGUF header parsing ---
function ggufBytes(entries, { version = 3 } = {}) {
  const out = [];
  const u32 = v => { const b = Buffer.alloc(4); b.writeUInt32LE(v); out.push(b); };
  const u64 = v => { const b = Buffer.alloc(8); b.writeBigUInt64LE(BigInt(v)); out.push(b); };
  const str = s => { const b = Buffer.from(s); u64(b.length); out.push(b); };
  const val = (type, v) => {
    switch (type) {
      case 0: case 1: case 7: out.push(Buffer.from([v ? Number(v) : 0])); break;
      case 2: case 3: out.push(Buffer.alloc(2)); break;
      case 4: case 5: u32(v); break;
      case 6: out.push(Buffer.alloc(4)); break;
      case 8: str(v); break;
      case 9: u32(v.type); u64(v.items.length); for (const it of v.items) val(v.type, it); break;
      case 10: case 11: u64(v); break;
      case 12: out.push(Buffer.alloc(8)); break;
    }
  };
  u32(0x46554747); u32(version); u64(0); u64(entries.length);
  for (const [key, type, v] of entries) { str(key); u32(type); val(type, v); }
  return Buffer.concat(out);
}

const HEADERS = {
  qwen35: ggufBytes([
    ['general.architecture', 8, 'qwen35'], ['general.name', 8, 'Qwen3.6 27B'], ['general.tags', 9, { type: 8, items: ['a', 'bb'] }],
    ['qwen35.block_count', 4, 65], ['qwen35.embedding_length', 4, 5120], ['qwen35.attention.head_count', 4, 24],
    ['qwen35.attention.head_count_kv', 4, 4], ['qwen35.attention.key_length', 4, 256], ['qwen35.full_attention_interval', 4, 4],
    ['qwen35.rope.freq_base', 6, 0], ['qwen35.nextn_predict_layers', 4, 1], ['split.count', 2, 0], ['split.count', 10, 3],
    ['tokenizer.ggml.tokens', 9, { type: 8, items: ['x'.repeat(10), 'y'] }],
  ]),
  gemma: ggufBytes([
    ['general.architecture', 8, 'gemma3n'], ['gemma3n.block_count', 5, 30], ['gemma3n.embedding_length', 10, 2048],
    ['gemma3n.attention.head_count', 4, 8], ['gemma3n.attention.head_count_kv', 9, { type: 4, items: [2, 2, 0, 2, 0, 1] }],
    ['gemma3n.attention.sliding_window', 4, 512], ['gemma3n.attention.sliding_window_pattern', 9, { type: 7, items: [1, 1, 0, 1, 1, 0] }],
    ['gemma3n.float64', 12, 0], ['gemma3n.i8', 1, 3], ['gemma3n.nested', 9, { type: 9, items: [{ type: 4, items: [1, 2] }] }],
  ]),
  noKv: ggufBytes([
    ['general.architecture', 8, 'llama'], ['llama.block_count', 4, 32], ['llama.embedding_length', 4, 4096],
    ['llama.attention.head_count', 4, 32], ['llama.attention.sliding_window_pattern', 4, 6],
    ['llama.attention.head_count_kv', 9, { type: 6, items: [0, 0] }], ['llama.u16', 2, 0],
  ]),
  missing: ggufBytes([['general.architecture', 8, 'llama'], ['llama.block_count', 4, 32]]),
  notGguf: Buffer.from('not a gguf file at all, just text'),
  v4: ggufBytes([], { version: 4 }),
};

test('GGUF header parsing from a local file', async () => {
  for (const [name, bytes] of Object.entries(HEADERS)) {
    const blob = new Blob([bytes]);
    assert.deepEqual(await gguf.readModelParams(blob), await orig.readModelParams(blob), name);
  }
  assert.deepEqual(await gguf.readModelParams(new Blob([HEADERS.qwen35])), {
    architecture: 'qwen35', hidden_layers: 65, hidden_size: 5120, attention_heads: 24, kv_heads: 4, key_length: 256,
    full_attention_interval: 4, nextn_layers: 1, split_count: 3,
  });
  const g = await gguf.readModelParams(new Blob([HEADERS.gemma]));
  assert.deepEqual([g.kv_heads, g.kv_heads_array, g.swa_layers, g.hidden_size], [2, [2, 2, 0, 2, 0, 1], 4, 2048]);
  assert.equal(await gguf.readModelParams(new Blob([HEADERS.notGguf])), null);
});

test('GGUF arrays with a crafted element count fail fast', async () => {
  // A u8 array claiming 2^40 elements with no data behind it: once through the generic skip, once through the
  // per-layer head_count_kv reader, which skips arrays it doesn't want
  const huge = (key, elemType) => {
    const head = ggufBytes([['general.architecture', 8, 'llama'], [key, 9, { type: elemType, items: [] }]]);
    head.writeBigUInt64LE(2n ** 40n, head.length - 8);
    return new Blob([head]);
  };
  for (const blob of [huge('llama.junk', 0), huge('llama.attention.head_count_kv', 0), huge('llama.junk', 8)]) {
    const started = Date.now();
    await assert.rejects(gguf.readModelParams(blob), /Array count too large/);
    assert.ok(Date.now() - started < 1000);
  }
  // Under the cap a fixed-size array is one seek, so parsing carries on to the keys after it
  const skipped = ggufBytes([
    ['general.architecture', 8, 'llama'], ['llama.scores', 9, { type: 6, items: Array(1000).fill(0) }],
    ['llama.block_count', 4, 32], ['llama.embedding_length', 4, 4096], ['llama.attention.head_count', 4, 32],
  ]);
  assert.deepEqual(await gguf.readModelParams(new Blob([skipped])), await orig.readModelParams(new Blob([skipped])));
});

// A fake HTTP server with Range support; `ranges` false mimics a server that ignores Range
function fakeFetch(files, { ranges = true } = {}) {
  return async (url, opts = {}) => {
    const body = files[url];
    if (!body) return new Response(null, { status: 404 });
    const len = body.length;
    if (opts.method === 'HEAD') return new Response(null, { status: 200, headers: { 'content-length': String(len) } });
    const m = (opts.headers?.Range || '').match(/bytes=(\d+)-(\d+)/);
    if (!m || !ranges) return new Response(body, { status: 200, headers: { 'content-length': String(len) } });
    const start = Number(m[1]), end = Math.min(Number(m[2]), len - 1);
    return new Response(body.subarray(start, end + 1), { status: 206, headers: { 'content-range': `bytes ${start}-${end}/${len}` } });
  };
}

test('GGUF header parsing and size over HTTP, including split models', async t => {
  const realFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = realFetch; });
  const big = Buffer.concat([HEADERS.qwen35, Buffer.alloc(700_000)]);
  const files = {
    'https://h/q.gguf': big,
    'https://h/s-00001-of-00003.gguf': big, 'https://h/s-00002-of-00003.gguf': Buffer.alloc(1000), 'https://h/s-00003-of-00003.gguf': Buffer.alloc(10),
    'https://h/g.gguf': HEADERS.gemma,
  };
  for (const ranges of [true, false]) {
    globalThis.fetch = fakeFetch(files, { ranges });
    for (const url of ['https://h/q.gguf', 'https://h/s-00002-of-00003.gguf', 'https://h/g.gguf', 'https://h/missing.gguf']) {
      let a, b;
      try { a = await gguf.readModelParams(url); } catch (e) { a = e.message; }
      try { b = await orig.readModelParams(url); } catch (e) { b = e.message; }
      assert.deepEqual(a, b, `${url} ranges=${ranges}`);
      if (a && typeof a === 'object') {
        const size = (await orig.totalSplitSizeFromUrl(url, b)) || (await orig.getRemoteFileSize(url));
        assert.equal(await gguf.remoteModelSize(url, a), size, url);
      }
    }
  }
  globalThis.fetch = fakeFetch(files);
  assert.equal(await gguf.remoteModelSize('https://h/s-00002-of-00003.gguf', { split_count: 3 }), big.length + 1010);
});
