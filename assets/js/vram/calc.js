// Pure vRAM estimation maths and option lists. No DOM, so node --test can import it directly.

export const GIB = 1024 * 1024 * 1024;
export const CUDA_SIZE = 500 * 1024 * 1024; // 500 MB base CUDA overhead
export const COMPUTE_BUFFER_SIZE = 1024 * 1024 * 1024; // ~1 GiB llama.cpp compute buffer allowance
// llama.cpp runs MTP as its own full-context llama_context; beyond the MTP
// layer's weights and KV, the duplicated embeddings and compute buffers
// measured ~2 GiB on a 27B (PR #22673: 2.49 GiB total at 10k ctx).
export const MTP_OVERHEAD_SIZE = 2 * 1024 * 1024 * 1024;

// Bytes per KV cache element. llama.cpp quantised cache types carry a per-block
// scale: q8_0 = 34 bytes / 32 elements (8.5 bpw), q4_0 = 18 / 32 (4.5 bpw).
export const KV_CACHE_BYTES = { FP16: 2.0, Q8_0: 1.0625, Q4_0: 0.5625 };

// Representative current-generation architectures used when no GGUF is loaded.
// kvElemsPerToken = 2 (K+V) * n_kv_heads * head_dim per layer; nearly all
// current dense/GQA models converge on 8 KV heads at head_dim 128 (= 2048).
export const ARCH_PRESETS = [
  [1.5, { layers: 28, kvElemsPerToken: 2048 }], // Qwen3-1.7B
  [4, { layers: 36, kvElemsPerToken: 2048 }], // Qwen3-4B
  [8, { layers: 36, kvElemsPerToken: 2048 }], // Qwen3-8B / Llama 3.1 8B
  [14, { layers: 40, kvElemsPerToken: 2048 }], // Qwen3-14B
  [24, { layers: 40, kvElemsPerToken: 2048 }], // Mistral Small 24B
  // Qwen3.6-27B is hybrid: 64 blocks but only 16 full-attention (4 KV heads
  // x 256 head_dim); the 48 linear-attention layers hold no per-token KV.
  // `blocks` (total transformer blocks) sizes MTP weights when it differs
  // from the KV-holding layer count.
  [27, { layers: 16, kvElemsPerToken: 2048, blocks: 64 }],
  [32, { layers: 64, kvElemsPerToken: 2048 }], // Qwen3-32B / Seed-OSS-36B
  [70, { layers: 80, kvElemsPerToken: 2048 }], // Llama 3.x 70B / Qwen2.5-72B
  [110, { layers: 92, kvElemsPerToken: 2048 }], // GLM-4.x class
  [671, { layers: 61, kvElemsPerToken: 576 }], // DeepSeek V3/R1 (MLA compressed KV)
];

export function nearestArchPreset(numParams) {
  let best = ARCH_PRESETS[0][1];
  let bestDiff = Infinity;
  for (const [size, arch] of ARCH_PRESETS) {
    const diff = Math.abs(Math.log(numParams / size));
    if (diff < bestDiff) { bestDiff = diff; best = arch; }
  }
  return best;
}

// Filename quant tag to bpw. Order matters: more specific tags come first
// (Q5_K_XL before Q5_K_L) because matching is by substring.
const QUANT_BPW = [
  ['F16', 16.00], ['FP16', 16.00],
  ['Q8_0', 8.50],
  ['Q6_K', 6.57],
  ['Q5_K_XL', 6.15], ['Q5_K_L', 5.90], ['Q5_K_M', 5.67], ['Q5_K_S', 5.52],
  ['Q4_K_XL', 5.45], ['Q4_K_L', 5.15], ['Q4_K_M', 4.83], ['Q4_K_S', 4.57],
  ['IQ4_NL', 4.56], ['IQ4_XS', 4.32],
  ['Q3_K_XL', 4.50], ['Q3_K_L', 4.22], ['Q3_K_M', 3.89], ['Q3_K_S', 3.50],
  ['IQ3_M', 3.63], ['IQ3_S', 3.52], ['IQ3_XXS', 3.21], ['IQ3_XS', 3.32],
  ['Q4_0', 4.00],
  ['Q2_K_S', 2.79], ['Q2_K', 3.00],
  ['IQ2_XXS', 2.20], ['IQ2_XS', 2.43], ['IQ2_S', 2.55], ['IQ2_M', 2.76],
  ['IQ1_S', 1.78],
];

export function extractQuantisationFromFilename(filename) {
  if (!filename) return null;
  const upper = filename.toUpperCase();
  for (const [tag, bpw] of QUANT_BPW) if (upper.includes(tag)) return bpw;
  return null;
}

export function normaliseHuggingFaceUrl(u) {
  if (!u || typeof u !== 'string') return u;
  if (!u.includes('huggingface.co/')) return u;
  const updated = u.replace(/\/blob\//, '/resolve/').replace(/\?raw=1|\?download=1|\?raw=true/i, '');
  return /\.gguf($|[?#])/.test(updated) ? updated : u;
}

const SPLIT_RE = /-(\d{2,})-of-(\d{2,})(?=\.|$)/;

export function parseSplitInfoFromUrl(url) {
  const m = url.match(SPLIT_RE);
  if (!m) return null;
  const index = Number(m[1]);
  const total = Number(m[2]);
  if (!Number.isFinite(index) || !Number.isFinite(total) || total <= 0) return null;
  return { index, total, width: m[1].length };
}

export function buildSplitUrlFrom(url, newIndex, width) {
  return url.replace(SPLIT_RE, `-${String(newIndex).padStart(width, '0')}-of-$2`);
}

// URLs of every part of a split GGUF, or null when the model is a single file
export function splitPartUrls(url, splitCount) {
  const info = parseSplitInfoFromUrl(url);
  const total = splitCount && splitCount > 1 ? splitCount : (info?.total || 0);
  if (!total || total <= 1) return null;
  const width = info?.width || 5;
  const urls = [];
  if (info) {
    for (let i = 1; i <= total; i++) urls.push(buildSplitUrlFrom(url, i, width));
  } else {
    const extIdx = url.lastIndexOf('.');
    const base = extIdx > -1 ? url.slice(0, extIdx) : url;
    const ext = extIdx > -1 ? url.slice(extIdx) : '';
    for (let i = 1; i <= total; i++) {
      urls.push(`${base}-${String(i).padStart(width, '0')}-of-${String(total).padStart(width, '0')}${ext}`);
    }
  }
  return urls;
}

// A local split file only gives us one part's size; assume the parts are equal.
export function localSplitTotalBytes(fileName, fileSize, splitCount) {
  if (!(splitCount && splitCount > 1)) return fileSize;
  const m = (fileName || '').match(SPLIT_RE);
  const inferredTotal = m ? Number(m[2]) : splitCount;
  return Number.isFinite(inferredTotal) && inferredTotal > 1 ? fileSize * inferredTotal : fileSize;
}

// Parameter count (billions, one decimal) implied by a file size and bpw
export const estimateParams = (sizeBytes, bpw) => Number(((sizeBytes / (bpw / 8)) / 1e9).toFixed(1));

// Total KV cache elements for a GGUF-described model, accounting for hybrid
// attention layouts: per-layer KV head arrays (0 = no KV on that layer),
// sliding-window layers capped at their window, and linear-attention layers
// (full_attention_interval) that hold no per-token KV at all.
export function ggufKvElements(meta, contextSize) {
  const layers = meta.hidden_layers;
  const headDim = meta.key_length || Math.round(meta.hidden_size / meta.attention_heads);

  if (Array.isArray(meta.kv_heads_array)) {
    const headSum = meta.kv_heads_array.reduce((a, b) => a + b, 0);
    return contextSize * 2 * headDim * headSum;
  }

  const perLayer = 2 * meta.kv_heads * headDim;

  // llama.cpp hardcodes Gemma 3's 5 local : 1 global pattern (every 6th layer
  // is global); Gemma 3n/4 and gpt-oss write the pattern to metadata instead.
  const pattern = meta.swa_pattern_interval || (meta.architecture === 'gemma3' ? 6 : 0);
  if (meta.sliding_window > 0 && (meta.swa_layers != null || pattern > 1)) {
    const swaLayers = meta.swa_layers != null ? meta.swa_layers : layers - Math.floor(layers / pattern);
    const fullLayers = layers - swaLayers;
    return (contextSize * fullLayers + Math.min(contextSize, meta.sliding_window) * swaLayers) * perLayer;
  }

  if (meta.full_attention_interval > 1) {
    // floor() also absorbs MTP-inflated block counts on qwen35-style GGUFs.
    return contextSize * Math.floor(layers / meta.full_attention_interval) * perLayer;
  }

  return contextSize * layers * perLayer;
}

// config: { numParams (billions), contextSize (tokens), bitsPerWeight, kvCacheType, mtpEnabled }
// Returns GiB: modelSize includes CUDA and compute buffer overheads.
export function calculateMemoryBreakdown(config, ggufMetadata = null, draftMetadata = null) {
  const { numParams, contextSize, bitsPerWeight, kvCacheType, mtpEnabled } = config;
  const bytesPerElement = KV_CACHE_BYTES[kvCacheType] || 2.0;

  let baseModelSize, totalBlocks, kvCacheSize, mtpKvElemsPerToken;

  if (ggufMetadata) {
    baseModelSize = ggufMetadata.modelSizeBytes || (numParams * 1e9 * bitsPerWeight) / 8;
    totalBlocks = ggufMetadata.hidden_layers;
    kvCacheSize = ggufKvElements(ggufMetadata, contextSize) * bytesPerElement;
    // head_dim often differs from hidden/heads (e.g. Qwen3-32B: 5120/64 = 80
    // but head_dim is 128), so prefer key_length.
    const headDim = ggufMetadata.key_length || Math.round(ggufMetadata.hidden_size / ggufMetadata.attention_heads);
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
    modelSize: (baseModelSize + CUDA_SIZE + COMPUTE_BUFFER_SIZE) / GIB,
    kvCacheSize: kvCacheSize / GIB,
  };
}

// The three KV cache types shown side by side, plus the shared bar scale (never below 24 GiB)
export function estimateAll(config, ggufMetadata = null, draftMetadata = null) {
  const rows = Object.keys(KV_CACHE_BYTES).map(kvCacheType => ({
    kvCacheType, ...calculateMemoryBreakdown({ ...config, kvCacheType }, ggufMetadata, draftMetadata),
  }));
  const maxMemory = Math.max(rows[0].modelSize + rows[0].kvCacheSize, 24);
  return { rows, maxMemory };
}

export const DEFAULT_GGUF_URL = 'https://huggingface.co/unsloth/Qwen3.6-27B-MTP-GGUF/resolve/main/Qwen3.6-27B-UD-Q5_K_XL.gguf';
export const DEFAULT_CONFIG = { numParams: 27, contextSize: 131072, bitsPerWeight: 5.67, mtpEnabled: true };

export const MODEL_SIZES = [1.5, 3.8, 7, 8, 14, 22, 24, 27, 32, 70, 72, 90, 110, 671].map(v => [v, `${v}B parameters`]);

export const CONTEXT_SIZES = [4, 8, 16, 32, 48, 64, 96, 128, 256].map(k => [k * 1024, `${k}K tokens`]);

export const QUANT_LEVELS = [
  [16.00, 'FP16'], [8.50, 'Q8_0'], [6.57, 'Q6_K'], [6.15, 'Q5_K_XL'], [5.90, 'Q5_K_L'], [5.67, 'Q5_K_M'],
  [5.52, 'Q5_K_S'], [5.45, 'Q4_K_XL'], [5.15, 'Q4_K_L'], [4.83, 'Q4_K_M'], [4.57, 'Q4_K_S'], [4.56, 'IQ4_NL'],
  [4.50, 'Q3_K_XL'], [4.32, 'IQ4_XS'], [4.22, 'Q3_K_L'], [4.00, 'Q4_0'], [3.89, 'Q3_K_M'], [3.63, 'IQ3_M'],
  [3.52, 'IQ3_S'], [3.50, 'Q3_K_S'], [3.32, 'IQ3_XS'], [3.21, 'IQ3_XXS'], [3.00, 'Q2_K'], [2.79, 'Q2_K_S'],
  [2.76, 'IQ2_M'], [2.55, 'IQ2_S'], [2.43, 'IQ2_XS'], [2.20, 'IQ2_XXS'], [1.78, 'IQ1_S'],
].map(([bpw, name]) => [bpw, `${name} (${bpw.toFixed(2)})`]);
