const CUDA_SIZE = 500 * 1024 * 1024; // 500 MB base CUDA overhead

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
    '.block_count',
    '.embedding_length',
    'split.count',
  ];

  const params = {};
  const found = { attention_heads: false, kv_heads: false, hidden_layers: false, hidden_size: false, split_count: false };

  for (let i = 0; i < metadataCount && !source.eof(); i++) {
    let key;
    try { key = await readString(source); } catch (e) { throw new Error(`Failed to read key: ${e.message}`); }

    const typeVal = await readU32(source);
    if (typeVal >= GGUFType.MAX_TYPE) throw new Error(`Invalid metadata type: ${typeVal} for key: ${key}`);
    const type = typeVal;

    const matchedSuffix = suffixes.find(s => key.endsWith(s));
    if (matchedSuffix) {
      if (matchedSuffix === '.attention.head_count' && (type === GGUFType.UINT32 || type === GGUFType.INT32)) {
        const value = await readU32(source); params.attention_heads = value; found.attention_heads = true;
      } else if (matchedSuffix === '.attention.head_count_kv' && (type === GGUFType.UINT32 || type === GGUFType.INT32)) {
        const value = await readU32(source); params.kv_heads = value; found.kv_heads = true;
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

    if (found.attention_heads && found.hidden_layers && found.hidden_size && (found.kv_heads || found.attention_heads)) {
      if (isUrl) { source.setAbortFlag?.(); }
      break;
    }
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

const calculateMemoryBreakdown = (config, ggufMetadata = null) => {
  const { numParams, contextSize, bitsPerWeight, kvCacheType } = config;

  let hiddenSize, numLayers, baseModelSize;

  if (ggufMetadata) {
    // Use actual GGUF metadata
    hiddenSize = ggufMetadata.hidden_size;
    numLayers = ggufMetadata.hidden_layers;
    baseModelSize = ggufMetadata.modelSizeBytes || (numParams * 1e9 * bitsPerWeight) / 8;
  } else {
    // Use formula-based estimation
    baseModelSize = (numParams * 1e9 * bitsPerWeight) / 8;
    hiddenSize = Math.sqrt(numParams * 1e9 / 12);
    numLayers = Math.round(numParams * 1e9 / (12 * hiddenSize * hiddenSize));
  }

  let kvCacheBits = 16;
  if (kvCacheType === 'Q8_0') kvCacheBits = 8;
  if (kvCacheType === 'Q4_0') kvCacheBits = 4;

  const kvCacheSize = contextSize * 2 * numLayers * hiddenSize * (kvCacheBits / 8);
  const attentionOverhead = contextSize * hiddenSize * 3 * (bitsPerWeight / 8);

  return {
    modelSize: (baseModelSize + CUDA_SIZE) / (1024 * 1024 * 1024),
    kvCacheSize: (kvCacheSize + attentionOverhead) / (1024 * 1024 * 1024)
  };
};

const Select = ({ label, value, onChange, options }) => {
  return React.createElement('div', { className: 'flex flex-col gap-2' },
    React.createElement('label', {
      className: 'text-sm font-medium text-gray-700 dark:text-gray-300'
    }, label),
    React.createElement('select', {
      value,
      onChange,
      className: 'w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:text-white'
    }, options.map(([value, label]) =>
      React.createElement('option', { key: value, value }, label)
    ))
  );
};

const Slider = ({ label, value, onChange, min, max, step }) => {
  return React.createElement('div', { className: 'flex flex-col gap-2' },
    React.createElement('div', { className: 'flex justify-between items-center' },
      React.createElement('label', {
        className: 'text-sm font-medium text-gray-700 dark:text-gray-300'
      }, label),
      React.createElement('span', {
        className: 'text-sm text-gray-600 dark:text-gray-400'
      }, `${value}${label.includes('Model') ? 'B' : 'K'}`)
    ),
    React.createElement('input', {
      type: 'range',
      min,
      max,
      step,
      value,
      onChange: (e) => onChange(Number(e.target.value)),
      className: 'w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-600 dark:accent-blue-400'
    })
  );
};

const ToggleButton = ({ label, value, onChange }) => {
  return React.createElement('button', {
    onClick: () => onChange(!value),
    className: `flex items-center space-x-2 text-sm font-medium ${value ? 'text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400'}`
  },
    React.createElement('div', {
      className: `w-9 h-5 rounded-full transition-colors duration-200 ${value ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'} relative`
    },
      React.createElement('div', {
        className: `w-4 h-4 rounded-full bg-white absolute top-0.5 left-0.5 transition-transform duration-200 ${value ? 'transform translate-x-4' : ''}`
      })
    ),
    React.createElement('span', null, label)
  );
};

const MemoryBar = ({ label, modelMemory, kvCacheMemory, maxMemory, colors }) => {
  const totalMemory = modelMemory + kvCacheMemory;
  const modelPercentage = (modelMemory / maxMemory) * 100;
  const kvCachePercentage = (kvCacheMemory / maxMemory) * 100;

  return React.createElement('div', { className: 'space-y-2' },
    React.createElement('div', { className: 'flex justify-between items-center' },
      React.createElement('span', {
        className: 'font-medium text-gray-900 dark:text-white'
      }, label),
      React.createElement('div', {
        className: 'text-sm space-x-4 text-gray-600 dark:text-gray-300'
      },
        React.createElement('span', null, `Model: ${modelMemory.toFixed(1)} GB`),
        React.createElement('span', null, `K/V: ${kvCacheMemory.toFixed(1)} GB`),
        React.createElement('span', {
          className: 'font-semibold'
        }, `Total: ${totalMemory.toFixed(1)} GB`)
      )
    ),
    React.createElement('div', {
      className: 'h-6 bg-gray-200 dark:bg-gray-700 rounded-lg overflow-hidden flex'
    },
      React.createElement('div', {
        className: `h-full ${colors.model} transition-all duration-300`,
        style: { width: `${modelPercentage}%` }
      }),
      React.createElement('div', {
        className: `h-full ${colors.kvCache} transition-all duration-300`,
        style: { width: `${kvCachePercentage}%` }
      })
    )
  );
};

const VRAMCalculator = () => {
  const [config, setConfig] = React.useState({
    numParams: 14,
    contextSize: 65536,
    bitsPerWeight: 4.83,
  });

  const [showAdvanced, setShowAdvanced] = React.useState(false);

  const [ggufUrl, setGgufUrl] = React.useState('https://huggingface.co/unsloth/Qwen3-30B-A3B-128K-GGUF/resolve/main/Qwen3-30B-A3B-128K-UD-Q5_K_XL.gguf');
  const [ggufMetadata, setGgufMetadata] = React.useState(null);
  const [loadingStatus, setLoadingStatus] = React.useState('');
  const [errorMessage, setErrorMessage] = React.useState('');
  const [dynamicModelSizes, setDynamicModelSizes] = React.useState([]);
  const fileInputRef = React.useRef(null);

  const [memoryBreakdown, setMemoryBreakdown] = React.useState({
    fp16: { modelSize: 0, kvCacheSize: 0 },
    q8_0: { modelSize: 0, kvCacheSize: 0 },
    q4_0: { modelSize: 0, kvCacheSize: 0 }
  });

  React.useEffect(() => {
    const fp16 = calculateMemoryBreakdown({ ...config, kvCacheType: 'FP16' }, ggufMetadata);
    const q8_0 = calculateMemoryBreakdown({ ...config, kvCacheType: 'Q8_0' }, ggufMetadata);
    const q4_0 = calculateMemoryBreakdown({ ...config, kvCacheType: 'Q4_0' }, ggufMetadata);

    setMemoryBreakdown({ fp16, q8_0, q4_0 });
  }, [config, ggufMetadata]);

  const maxMemory = Math.max(
    memoryBreakdown.fp16.modelSize + memoryBreakdown.fp16.kvCacheSize,
    24
  );

  const handleLoadFromUrl = async () => {
    setErrorMessage('');
    setLoadingStatus('');

    let url = ggufUrl.trim();
    if (!url) {
      setErrorMessage('Please enter a GGUF URL');
      return;
    }

    const normalized = normalizeHuggingFaceUrl(url);
    if (normalized !== url) {
      setGgufUrl(normalized);
      url = normalized;
    }

    setLoadingStatus('Loading GGUF metadata...');

    try {
      const params = await readModelParams(url, { verbose: false });
      if (!params) {
        setErrorMessage('Failed to read GGUF metadata. Ensure the URL points to a valid GGUF file.');
        setLoadingStatus('');
        return;
      }

      let sizeBytesTotal = await totalSplitSizeFromUrl(url, params, { verbose: false });
      if (!sizeBytesTotal) {
        const single = await getRemoteFileSize(url, { verbose: false });
        if (single) sizeBytesTotal = single;
      }

      const fileName = url.split('/').pop() || 'GGUF file';
      const metadata = {
        ...params,
        modelSizeBytes: sizeBytesTotal || 0,
        fileName
      };

      setGgufMetadata(metadata);

      // Extract quantization format from filename
      const detectedQuant = extractQuantizationFromFilename(fileName);

      // Calculate params from file size and update config
      if (sizeBytesTotal) {
        const bpw = detectedQuant || config.bitsPerWeight;
        const estimatedParams = (sizeBytesTotal / (bpw / 8)) / 1e9;
        const roundedParams = Number(estimatedParams.toFixed(1));

        // Add to dynamic model sizes if not already in static list
        const staticModelValues = [1.5, 3.8, 7, 8, 14, 22, 24, 32, 70, 72, 90, 110, 671];
        if (!staticModelValues.includes(roundedParams) && !dynamicModelSizes.some(s => s[0] === roundedParams)) {
          setDynamicModelSizes(prev => [...prev, [roundedParams, `${roundedParams}B parameters (from GGUF)`]]);
        }

        // Update config with detected quantization and calculated params
        setConfig(prev => ({
          ...prev,
          numParams: roundedParams,
          ...(detectedQuant && { bitsPerWeight: detectedQuant })
        }));
      } else if (detectedQuant) {
        // If we only have quantization but no file size, still update it
        setConfig(prev => ({ ...prev, bitsPerWeight: detectedQuant }));
      }

      setLoadingStatus('Successfully loaded GGUF metadata');
      setTimeout(() => setLoadingStatus(''), 3000);
    } catch (error) {
      if (error.message && error.message.includes('CORS')) {
        setErrorMessage('CORS error: This server does not allow cross-origin requests. Try downloading the file and using the local file option.');
      } else if (error.message && error.message.includes('HTTP error')) {
        setErrorMessage(`Network error: ${error.message}. The server may not support Range requests.`);
      } else {
        setErrorMessage(`Error: ${error.message || 'Failed to load GGUF file'}`);
      }
      setLoadingStatus('');
    }
  };

  const handleLoadFromFile = async () => {
    setErrorMessage('');
    setLoadingStatus('');

    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setErrorMessage('Please select a GGUF file');
      return;
    }

    setLoadingStatus('Reading local GGUF file...');

    try {
      const params = await readModelParams(file, { verbose: false });
      if (!params) {
        setErrorMessage('Failed to read GGUF metadata. Ensure this is a valid GGUF file.');
        setLoadingStatus('');
        return;
      }

      let totalBytes = file.size;
      if (params.split_count && params.split_count > 1) {
        const m = (file.name || '').match(/-(\d{2,})-of-(\d{2,})(?=\.|$)/);
        const inferredTotal = m ? Number(m[2]) : params.split_count;
        if (Number.isFinite(inferredTotal) && inferredTotal > 1) {
          totalBytes = file.size * inferredTotal;
        }
      }

      const metadata = {
        ...params,
        modelSizeBytes: totalBytes,
        fileName: file.name
      };

      setGgufMetadata(metadata);

      // Extract quantization format from filename
      const detectedQuant = extractQuantizationFromFilename(file.name);

      // Calculate params from file size
      const bpw = detectedQuant || config.bitsPerWeight;
      const estimatedParams = (totalBytes / (bpw / 8)) / 1e9;
      const roundedParams = Number(estimatedParams.toFixed(1));

      // Add to dynamic model sizes if not already in static list
      const staticModelValues = [1.5, 3.8, 7, 8, 14, 22, 24, 32, 70, 72, 90, 110, 671];
      if (!staticModelValues.includes(roundedParams) && !dynamicModelSizes.some(s => s[0] === roundedParams)) {
        setDynamicModelSizes(prev => [...prev, [roundedParams, `${roundedParams}B parameters (from GGUF)`]]);
      }

      // Update config with detected quantization and calculated params
      setConfig(prev => ({
        ...prev,
        numParams: roundedParams,
        ...(detectedQuant && { bitsPerWeight: detectedQuant })
      }));

      setLoadingStatus('Successfully loaded GGUF metadata from local file');
      setTimeout(() => setLoadingStatus(''), 3000);
    } catch (error) {
      setErrorMessage(`Error: ${error.message || 'Failed to read GGUF file'}`);
      setLoadingStatus('');
    }
  };

  const handleClearMetadata = () => {
    setGgufMetadata(null);
    setGgufUrl('https://huggingface.co/unsloth/Qwen3-30B-A3B-128K-GGUF/resolve/main/Qwen3-30B-A3B-128K-UD-Q5_K_XL.gguf');
    setErrorMessage('');
    setLoadingStatus('');
    setDynamicModelSizes([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const staticModelSizes = [
    [1.5, '1.5B parameters'],
    [3.8, '3.8B parameters'],
    [7, '7B parameters'],
    [8, '8B parameters'],
    [14, '14B parameters'],
    [22, '22B parameters'],
    [24, '24B parameters'],
    [32, '32B parameters'],
    [70, '70B parameters'],
    [72, '72B parameters'],
    [90, '90B parameters'],
    [110, '110B parameters'],
    [671, '671B parameters']
  ];

  // Combine static and dynamic model sizes, sorted by parameter count
  const modelSizes = React.useMemo(() => {
    return [...staticModelSizes, ...dynamicModelSizes].sort((a, b) => a[0] - b[0]);
  }, [dynamicModelSizes]);

  const contextSizes = [
    [4096, '4K tokens'],
    [8192, '8K tokens'],
    [16384, '16K tokens'],
    [32768, '32K tokens'],
    [49152, '48K tokens'],
    [65536, '64K tokens'],
    [98304, '96K tokens'],
    [131072, '128K tokens'],
    [262144, '256K tokens']
  ];

  const quantizationLevels = [
    [16.00, 'FP16 (16.00)'],
    [8.50, 'Q8_0 (8.50)'],
    [6.57, 'Q6_K (6.57)'],
    [6.15, 'Q5_K_XL (6.15)'],
    [5.90, 'Q5_K_L (5.90)'],
    [5.67, 'Q5_K_M (5.67)'],
    [5.52, 'Q5_K_S (5.52)'],
    [5.45, 'Q4_K_XL (5.45)'],
    [5.15, 'Q4_K_L (5.15)'],
    [4.83, 'Q4_K_M (4.83)'],
    [4.57, 'Q4_K_S (4.57)'],
    [4.56, 'IQ4_NL (4.56)'],
    [4.50, 'Q3_K_XL (4.50)'],
    [4.32, 'IQ4_XS (4.32)'],
    [4.22, 'Q3_K_L (4.22)'],
    [4.00, 'Q4_0 (4.00)'],
    [3.89, 'Q3_K_M (3.89)'],
    [3.63, 'IQ3_M (3.63)'],
    [3.52, 'IQ3_S (3.52)'],
    [3.50, 'Q3_K_S (3.50)'],
    [3.32, 'IQ3_XS (3.32)'],
    [3.21, 'IQ3_XXS (3.21)'],
    [3.00, 'Q2_K (3.00)'],
    [2.79, 'Q2_K_S (2.79)'],
    [2.76, 'IQ2_M (2.76)'],
    [2.55, 'IQ2_S (2.55)'],
    [2.43, 'IQ2_XS (2.43)'],
    [2.20, 'IQ2_XXS (2.20)'],
    [1.78, 'IQ1_S (1.78)']
  ];

  const renderControls = () => {
    if (showAdvanced) {
      return React.createElement('div', { className: 'space-y-6' },
        React.createElement(Slider, {
          label: 'Model Size',
          value: config.numParams,
          onChange: (value) => setConfig(prev => ({ ...prev, numParams: value })),
          min: 1,
          max: 671,
          step: 0.1
        }),
        React.createElement(Slider, {
          label: 'Context Size',
          value: config.contextSize / 1024, // Convert to K
          onChange: (value) => setConfig(prev => ({ ...prev, contextSize: value * 1024 })),
          min: 1,
          max: 256,
          step: 1
        })
      );
    }

    return React.createElement('div', {
      className: 'grid grid-cols-1 md:grid-cols-2 gap-6'
    },
      React.createElement(Select, {
        label: 'Model Size',
        value: config.numParams,
        onChange: (e) => setConfig(prev => ({ ...prev, numParams: Number(e.target.value) })),
        options: modelSizes
      }),
      React.createElement(Select, {
        label: 'Context Size',
        value: config.contextSize,
        onChange: (e) => setConfig(prev => ({ ...prev, contextSize: Number(e.target.value) })),
        options: contextSizes
      })
    );
  };

  return React.createElement('div', {
    className: 'vram-calculator max-w-3xl mx-auto rounded-xl shadow-lg bg-white dark:bg-gray-800 p-6 space-y-6'
  },
    React.createElement('div', {
      className: 'flex justify-between items-center'
    },
      React.createElement('h4', {
        className: 'text-xl font-bold text-gray-900 dark:text-white'
      }, 'VRAM Usage Estimator'),
      React.createElement(ToggleButton, {
        label: 'Advanced',
        value: showAdvanced,
        onChange: setShowAdvanced
      })
    ),

    // GGUF Loader Section
    React.createElement('div', {
      className: 'border border-gray-300 dark:border-gray-600 rounded-lg p-4 space-y-3 bg-gray-50 dark:bg-gray-750'
    },
      React.createElement('div', { className: 'flex flex-col sm:flex-row gap-2' },
        React.createElement('div', { className: 'flex-1' },
          React.createElement('label', {
            className: 'text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1'
          }, 'GGUF URL (optional):'),
          React.createElement('input', {
            type: 'text',
            value: ggufUrl,
            onChange: (e) => setGgufUrl(e.target.value),
            placeholder: 'https://huggingface.co/.../model.gguf',
            className: 'w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white',
            onKeyPress: (e) => { if (e.key === 'Enter') handleLoadFromUrl(); }
          })
        ),
        React.createElement('button', {
          onClick: handleLoadFromUrl,
          disabled: !ggufUrl.trim() || loadingStatus !== '',
          className: 'sm:self-end px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg text-sm font-medium transition-colors'
        }, 'Load')
      ),
      showAdvanced && React.createElement('div', { className: 'flex flex-col sm:flex-row gap-2 items-start sm:items-center' },
        React.createElement('div', { className: 'flex-1' },
          React.createElement('label', {
            className: 'text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1'
          }, 'Or choose local file:'),
          React.createElement('input', {
            ref: fileInputRef,
            type: 'file',
            accept: '.gguf',
            onChange: handleLoadFromFile,
            className: 'w-full text-sm text-gray-700 dark:text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-600 file:text-white hover:file:bg-blue-700 file:cursor-pointer'
          })
        )
      ),
      ggufMetadata && React.createElement('div', {
        className: 'flex items-start justify-between bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3'
      },
        React.createElement('div', { className: 'flex-1' },
          React.createElement('div', {
            className: 'text-sm font-semibold text-green-800 dark:text-green-300 flex items-center gap-2'
          },
            React.createElement('span', null, '✓'),
            React.createElement('span', null, 'Using GGUF metadata from: ' + ggufMetadata.fileName)
          ),
          React.createElement('div', {
            className: 'text-xs text-green-700 dark:text-green-400 mt-1'
          }, `${(ggufMetadata.modelSizeBytes / 1e9).toFixed(1)}GB, ${ggufMetadata.hidden_layers} layers, ${ggufMetadata.hidden_size} hidden size${ggufMetadata.split_count > 1 ? `, ${ggufMetadata.split_count} splits` : ''}`)
        ),
        React.createElement('button', {
          onClick: handleClearMetadata,
          className: 'text-green-800 dark:text-green-300 hover:text-green-600 dark:hover:text-green-400 text-sm font-medium ml-2'
        }, 'Clear')
      ),
      loadingStatus && React.createElement('div', {
        className: 'text-sm text-blue-600 dark:text-blue-400'
      }, loadingStatus),
      errorMessage && React.createElement('div', {
        className: 'text-sm text-red-600 dark:text-red-400'
      }, errorMessage)
    ),

    renderControls(),

    React.createElement(Select, {
      label: 'Quantization Level (bpw)',
      value: config.bitsPerWeight,
      onChange: (e) => setConfig(prev => ({ ...prev, bitsPerWeight: Number(e.target.value) })),
      options: quantizationLevels
    }),

    React.createElement('div', { className: 'space-y-6 mt-6' },
      React.createElement(MemoryBar, {
        label: 'FP16 K/V Cache',
        modelMemory: memoryBreakdown.fp16.modelSize,
        kvCacheMemory: memoryBreakdown.fp16.kvCacheSize,
        maxMemory,
        colors: {
          model: 'bg-blue-600 dark:bg-blue-700',
          kvCache: 'bg-blue-400 dark:bg-blue-500'
        }
      }),
      React.createElement(MemoryBar, {
        label: 'Q8_0 K/V Cache',
        modelMemory: memoryBreakdown.q8_0.modelSize,
        kvCacheMemory: memoryBreakdown.q8_0.kvCacheSize,
        maxMemory,
        colors: {
          model: 'bg-green-600 dark:bg-green-700',
          kvCache: 'bg-green-400 dark:bg-green-500'
        }
      }),
      React.createElement(MemoryBar, {
        label: 'Q4_0 K/V Cache',
        modelMemory: memoryBreakdown.q4_0.modelSize,
        kvCacheMemory: memoryBreakdown.q4_0.kvCacheSize,
        maxMemory,
        colors: {
          model: 'bg-purple-600 dark:bg-purple-700',
          kvCache: 'bg-purple-400 dark:bg-purple-500'
        }
      })
    )
  );
};

window.initVRAMCalculator = function (container) {
  ReactDOM.render(React.createElement(VRAMCalculator), container);
};
