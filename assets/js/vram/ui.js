// The estimator's DOM: built once per root, then render() syncs it to state after every change.
import {
  estimateAll, estimateParams, extractQuantisationFromFilename, normaliseHuggingFaceUrl, localSplitTotalBytes,
  DEFAULT_CONFIG, DEFAULT_GGUF_URL, MODEL_SIZES, CONTEXT_SIZES, QUANT_LEVELS, GIB,
} from './calc.js';
import { readModelParams, remoteModelSize } from './gguf.js';

// Marks a root as live. An expando rather than an attribute, because the shell's cached copies of a page are
// clones: they carry attributes but not listeners, so a clone must be built again.
const BOUND = '__vramEst';

const BARS = [
  ['FP16', 'F16 K/V cache', '16 bpw'],
  ['Q8_0', 'Q8_0 K/V cache', '8.5 bpw'],
  ['Q4_0', 'Q4_0 K/V cache', '4.5 bpw'],
];

function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else if (v === true) el.setAttribute(k, '');
    else if (v != null && v !== false) el.setAttribute(k, v);
  }
  el.append(...kids.flat().filter(k => k != null && k !== false));
  return el;
}

const gib = bytes => (bytes / GIB).toFixed(1);
const fmt = n => `${n.toFixed(1)} GiB`;

// Keeps a select's options in step with a list, adding the current value when it isn't in the list
// (a slider or a loaded GGUF can pick sizes the presets don't have).
function syncSelect(sel, options, value, label) {
  const list = options.some(([v]) => v === value) ? options : [...options, [value, label(value)]].sort((a, b) => a[0] - b[0]);
  const sig = list.map(o => o.join('|')).join(',');
  if (sel.dataset.sig !== sig) {
    sel.replaceChildren(...list.map(([v, l]) => h('option', { value: String(v) }, l)));
    sel.dataset.sig = sig;
  }
  sel.value = String(value);
}

export function mount(root) {
  if (root[BOUND]) return;
  root[BOUND] = true;

  const s = {
    ...DEFAULT_CONFIG, advanced: false, ggufUrl: DEFAULT_GGUF_URL, draftUrl: '',
    gguf: null, draft: null, status: '', error: '', dynamicSizes: [],
  };
  let statusTimer = 0;
  const set = patch => { Object.assign(s, patch); render(); };
  const flash = msg => {
    set({ status: msg });
    clearTimeout(statusTimer);
    statusTimer = setTimeout(() => set({ status: '' }), 3000);
  };
  const num = fn => e => fn(Number(e.target.value));

  // Sizes derived from a GGUF join the model size list so the select can show them
  const addDynamicSize = params => {
    if (MODEL_SIZES.some(([v]) => v === params) || s.dynamicSizes.some(([v]) => v === params)) return;
    s.dynamicSizes = [...s.dynamicSizes, [params, `${params}B parameters (from GGUF)`]];
  };

  async function loadUrl() {
    set({ error: '', status: '' });
    let url = s.ggufUrl.trim();
    if (!url) return set({ error: 'Please enter a GGUF URL' });
    url = normaliseHuggingFaceUrl(url);
    set({ ggufUrl: url, status: 'Loading GGUF metadata...' });
    try {
      const params = await readModelParams(url);
      if (!params) return set({ error: 'Failed to read GGUF metadata. Ensure the URL points to a valid GGUF file.', status: '' });
      const size = await remoteModelSize(url, params);
      const fileName = url.split('/').pop() || 'GGUF file';
      const quant = extractQuantisationFromFilename(fileName);
      const patch = { gguf: { ...params, modelSizeBytes: size || 0, fileName } };
      if (size) {
        patch.numParams = estimateParams(size, quant || s.bitsPerWeight);
        addDynamicSize(patch.numParams);
      }
      if (quant) patch.bitsPerWeight = quant;
      set(patch);
      flash('Successfully loaded GGUF metadata');
    } catch (err) {
      const m = err.message || '';
      set({
        status: '',
        error: m.includes('CORS') ? 'CORS error: This server does not allow cross-origin requests. Try downloading the file and using the local file option.'
          : m.includes('HTTP error') ? `Network error: ${m}. The server may not support Range requests.`
            : `Error: ${m || 'Failed to load GGUF file'}`,
      });
    }
  }

  async function loadFile() {
    set({ error: '', status: '' });
    const file = fileInput.files?.[0];
    if (!file) return set({ error: 'Please select a GGUF file' });
    set({ status: 'Reading local GGUF file...' });
    try {
      const params = await readModelParams(file);
      if (!params) return set({ error: 'Failed to read GGUF metadata. Ensure this is a valid GGUF file.', status: '' });
      const totalBytes = localSplitTotalBytes(file.name, file.size, params.split_count);
      const quant = extractQuantisationFromFilename(file.name);
      const numParams = estimateParams(totalBytes, quant || s.bitsPerWeight);
      addDynamicSize(numParams);
      set({ gguf: { ...params, modelSizeBytes: totalBytes, fileName: file.name }, numParams, ...(quant && { bitsPerWeight: quant }) });
      flash('Successfully loaded GGUF metadata from local file');
    } catch (err) {
      set({ error: `Error: ${err.message || 'Failed to read GGUF file'}`, status: '' });
    }
  }

  async function loadDraft() {
    set({ error: '', status: '' });
    let url = s.draftUrl.trim();
    if (!url) return set({ error: 'Please enter a draft model GGUF URL' });
    url = normaliseHuggingFaceUrl(url);
    set({ draftUrl: url, status: 'Loading draft model GGUF metadata...' });
    try {
      const params = await readModelParams(url);
      if (!params) return set({ error: 'Failed to read draft model GGUF metadata. Ensure the URL points to a valid GGUF file.', status: '' });
      const size = await remoteModelSize(url, params);
      set({ draft: { ...params, modelSizeBytes: size || 0, fileName: url.split('/').pop() || 'draft GGUF' } });
      flash('Successfully loaded draft model metadata');
    } catch (err) {
      set({ error: `Error loading draft model: ${err.message || 'Failed to load GGUF file'}`, status: '' });
    }
  }

  const clearGguf = () => {
    fileInput.value = '';
    set({ gguf: null, ggufUrl: DEFAULT_GGUF_URL, error: '', status: '', dynamicSizes: [] });
  };
  const clearDraft = () => set({ draft: null, draftUrl: '' });
  const onEnter = fn => e => { if (e.key === 'Enter') fn(); };

  // --- DOM ---
  const advanced = h('input', { type: 'checkbox', role: 'switch', onchange: e => set({ advanced: e.target.checked }) });
  const modelSel = h('select', { onchange: num(v => set({ numParams: v })) });
  const ctxSel = h('select', { onchange: num(v => set({ contextSize: v })) });
  const quantSel = h('select', { onchange: num(v => set({ bitsPerWeight: v })) });
  const modelRange = h('input', { type: 'range', min: 1, max: 671, step: 0.1, oninput: num(v => set({ numParams: v })) });
  const ctxRange = h('input', { type: 'range', min: 1, max: 256, step: 1, oninput: num(v => set({ contextSize: v * 1024 })) });
  const modelOut = h('output'), ctxOut = h('output');
  const mtp = h('input', { type: 'checkbox', role: 'switch', onchange: e => set({ mtpEnabled: e.target.checked }) });
  const mtpNote = h('small', { class: 've-hint' }, 'MTP layers were stripped from this GGUF at quantisation');

  const urlInput = h('input', {
    type: 'url', inputmode: 'url', autocomplete: 'off', spellcheck: 'false', placeholder: 'https://huggingface.co/.../model.gguf',
    oninput: e => set({ ggufUrl: e.target.value }), onkeydown: onEnter(loadUrl),
  });
  const urlBtn = h('button', { type: 'button', class: 've-btn', onclick: loadUrl }, 'Load');
  const fileInput = h('input', { type: 'file', accept: '.gguf', onchange: loadFile });
  const draftInput = h('input', {
    type: 'url', inputmode: 'url', autocomplete: 'off', spellcheck: 'false', placeholder: 'https://huggingface.co/.../draft-model.gguf',
    oninput: e => set({ draftUrl: e.target.value }), onkeydown: onEnter(loadDraft),
  });
  const draftBtn = h('button', { type: 'button', class: 've-btn', onclick: loadDraft }, 'Load');
  const ggufCard = h('div', { class: 've-card' });
  const draftCard = h('div', { class: 've-card' });
  const status = h('p', { class: 've-status', role: 'status' });
  const error = h('p', { class: 've-error', role: 'alert' });
  const loaderInputs = h('div', { class: 've-loader-inputs' },
    h('label', { class: 've-field' }, h('span', null, 'GGUF URL (optional)'), h('span', { class: 've-inline' }, urlInput, urlBtn)),
    h('label', { class: 've-field' }, h('span', null, 'Or choose a local file'), fileInput),
    h('label', { class: 've-field' }, h('span', null, 'Draft model GGUF URL (optional, for DFlash / speculative decoding)'),
      h('span', { class: 've-inline' }, draftInput, draftBtn)));
  const loader = h('section', { class: 've-loader', 'aria-label': 'Model metadata' }, loaderInputs, draftCard, ggufCard, status, error);

  const field = (label, ...controls) => h('label', { class: 've-field' }, h('span', null, label), ...controls);
  const basic = [field('Model size', modelSel), field('Context size', ctxSel)];
  const adv = [
    field('Model size', h('span', { class: 've-range' }, modelRange, modelOut)),
    field('Context size', h('span', { class: 've-range' }, ctxRange, ctxOut)),
  ];

  const bars = BARS.map(([key, name, bpw]) => {
    const m = h('span', { class: 've-seg ve-seg-m' }), k = h('span', { class: 've-seg ve-seg-k' });
    const total = h('strong'), mv = h('span'), kv = h('span');
    const el = h('div', { class: `ve-row ve-${key.toLowerCase()}` },
      h('div', { class: 've-row-head' }, h('span', { class: 've-name' }, name, ' ', h('small', null, bpw)), total),
      h('div', { class: 've-bar', 'aria-hidden': 'true' }, m, k),
      h('div', { class: 've-nums' }, h('span', { class: 've-key ve-key-m' }, 'Model ', mv), h('span', { class: 've-key ve-key-k' }, 'K/V ', kv)));
    return { key, el, m, k, total, mv, kv };
  });

  root.replaceChildren(
    h('div', { class: 've-head' }, h('label', { class: 've-switch' }, advanced, h('span', null, 'Advanced'))),
    loader,
    h('div', { class: 've-controls' }, ...basic, ...adv,
      field('Quantisation level (bpw)', quantSel),
      h('div', { class: 've-mtp' }, h('label', { class: 've-switch' }, mtp, h('span', null, 'MTP speculative decoding')), mtpNote)),
    h('div', { class: 've-results', 'aria-live': 'polite' }, bars.map(b => b.el)),
    h('p', { class: 've-note' },
      'Hybrid attention layouts (linear or sliding-window layers, e.g. Qwen3.6, Gemma 3, gpt-oss) are detected from GGUF metadata when loaded; the size presets assume typical current-generation architectures. vLLM FP8 KV cache is roughly equivalent to Q8_0. MTP adds its layer weights, full-context KV and ~2 GiB of buffers; ngram lookup speculation uses host RAM only.'));

  function render() {
    advanced.checked = s.advanced;
    for (const el of basic) el.hidden = s.advanced;
    for (const el of adv) el.hidden = !s.advanced;

    const sizes = [...MODEL_SIZES, ...s.dynamicSizes].sort((a, b) => a[0] - b[0]);
    syncSelect(modelSel, sizes, s.numParams, v => `${v}B parameters`);
    syncSelect(ctxSel, CONTEXT_SIZES, s.contextSize, v => `${v / 1024}K tokens`);
    syncSelect(quantSel, QUANT_LEVELS, s.bitsPerWeight, v => `${v}`);
    modelRange.value = s.numParams;
    ctxRange.value = s.contextSize / 1024;
    modelOut.textContent = `${s.numParams}B`;
    ctxOut.textContent = `${s.contextSize / 1024}K`;

    // MTP needs nextn layers present in the GGUF; quantisers often strip them.
    const mtpAvailable = !s.gguf || (s.gguf.nextn_layers || 0) > 0;
    mtp.checked = s.mtpEnabled && mtpAvailable;
    mtp.disabled = !mtpAvailable;
    mtpNote.hidden = mtpAvailable;

    // Loaded metadata stays visible outside Advanced so it's clear what the numbers are based on
    loader.hidden = !(s.advanced || s.gguf || s.draft || s.status || s.error);
    loaderInputs.hidden = !s.advanced;
    if (urlInput.value !== s.ggufUrl) urlInput.value = s.ggufUrl;
    if (draftInput.value !== s.draftUrl) draftInput.value = s.draftUrl;
    urlBtn.disabled = !s.ggufUrl.trim() || s.status !== '';
    draftBtn.disabled = !s.draftUrl.trim() || s.status !== '';
    status.textContent = s.status;
    status.hidden = !s.status;
    error.textContent = s.error;
    error.hidden = !s.error;

    const g = s.gguf, d = s.draft;
    ggufCard.hidden = !g;
    if (g) {
      ggufCard.replaceChildren(
        h('div', null, h('b', null, 'Using GGUF metadata from: ', g.fileName),
          h('small', null, `${gib(g.modelSizeBytes)} GiB, ${g.hidden_layers} layers, ${g.hidden_size} hidden size, ${g.kv_heads} KV heads`
            + (g.key_length ? ` x ${g.key_length} head dim` : '')
            + (g.nextn_layers > 0 ? `, ${g.nextn_layers} MTP layer${g.nextn_layers > 1 ? 's' : ''}` : '')
            + (g.split_count > 1 ? `, ${g.split_count} splits` : ''))),
        h('button', { type: 'button', class: 've-btn ve-btn-quiet', onclick: clearGguf }, 'Clear'));
    }
    draftCard.hidden = !d;
    if (d) {
      draftCard.replaceChildren(
        h('div', null, h('b', null, 'Draft model: ', d.fileName),
          h('small', null, `${gib(d.modelSizeBytes)} GiB, ${d.hidden_layers} layers, ${d.kv_heads} KV heads`)),
        h('button', { type: 'button', class: 've-btn ve-btn-quiet', onclick: clearDraft }, 'Clear'));
    }

    const { rows, maxMemory } = estimateAll(s, s.gguf, s.draft);
    for (const b of bars) {
      const r = rows.find(x => x.kvCacheType === b.key);
      b.m.style.width = `${(r.modelSize / maxMemory) * 100}%`;
      b.k.style.width = `${(r.kvCacheSize / maxMemory) * 100}%`;
      b.total.textContent = fmt(r.modelSize + r.kvCacheSize);
      b.mv.textContent = fmt(r.modelSize);
      b.kv.textContent = fmt(r.kvCacheSize);
    }
  }

  render();
}
