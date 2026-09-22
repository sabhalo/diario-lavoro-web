export const TRANSFORMERS_URL = "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1";
export const ASR_PROFILES = Object.freeze({
  rapid: Object.freeze({ id: "rapid", model: "Xenova/whisper-tiny", dtype: "q8", device: "wasm", label: "Rapido", size: "104,9 MB osservati" }),
  balanced: Object.freeze({ id: "balanced", model: "Xenova/whisper-base", dtype: "q8", device: "wasm", label: "Qualità", size: "download e prestazioni da misurare" }),
  precision: Object.freeze({ id: "precision", model: "Xenova/whisper-small", dtype: "q8", device: "wasm", label: "Alta qualità", size: "circa 252 MB di pesi q8, più runtime/cache" }),
});
export const ASR_MODEL = ASR_PROFILES.rapid.model;
let transformers;

export function asrProfile(value = "rapid") {
  return ASR_PROFILES[value] || Object.values(ASR_PROFILES).find((profile) => profile.model === value) || ASR_PROFILES.rapid;
}

export function webGpuAvailable() { return typeof navigator !== "undefined" && !!navigator.gpu; }

export function createAsrPreparationGate() {
  let active = false;
  return async (operation) => {
    if (active) throw new Error("Preparazione ASR già in corso.");
    active = true;
    try { return await operation(); }
    finally { active = false; }
  };
}

export async function createAsrPipeline({ profile: selectedProfile, model = ASR_MODEL, cacheOnly = false, progress = () => {} } = {}) {
  const profile = selectedProfile ? asrProfile(selectedProfile.id || selectedProfile) : asrProfile(model);
  if (profile.requiresWebGPU && !webGpuAvailable()) throw new Error("WebGPU non disponibile per il profilo ASR selezionato.");
  transformers ||= await import(TRANSFORMERS_URL);
  transformers.env.allowRemoteModels = !cacheOnly;
  const options = { dtype: profile.dtype, progress_callback: progress };
  if (profile.device === "webgpu") options.device = "webgpu";
  try { return await transformers.pipeline("automatic-speech-recognition", profile.model, options); }
  finally { transformers.env.allowRemoteModels = true; }
}

export async function decodeTo16k(blob) {
  const context = new AudioContext();
  try { const decoded = await context.decodeAudioData(await blob.arrayBuffer()); const offline = new OfflineAudioContext(1, Math.ceil(decoded.duration * 16_000), 16_000); const source = offline.createBufferSource(); source.buffer = decoded; source.connect(offline.destination); source.start(); const rendered = await offline.startRendering(); return rendered.getChannelData(0).slice(); }
  finally { await context.close(); }
}

export function audioMetrics(samples, rate = 16_000) { let sum = 0, peak = 0; for (const sample of samples) { sum += sample * sample; peak = Math.max(peak, Math.abs(sample)); } return { samples: samples.length, seconds: samples.length / rate, rms: Math.sqrt(sum / Math.max(1, samples.length)), peak, rate }; }

export function asrResultShape(result) {
  const chunks = Array.isArray(result?.chunks) ? result.chunks : [];
  return { resultType: result == null ? String(result) : typeof result, keys: result && typeof result === "object" ? Object.keys(result).sort().slice(0, 12) : [], textChars: typeof result?.text === "string" ? result.text.trim().length : 0, chunks: chunks.length, nonEmptyChunks: chunks.filter((item) => typeof item?.text === "string" && item.text.trim()).length, timestampedChunks: chunks.filter((item) => Array.isArray(item?.timestamp)).length };
}

export function usesWholeBlockTimestamp(result) { const shape = asrResultShape(result); return shape.textChars > 0 && shape.nonEmptyChunks === 0; }

export function asrChunks(result, block) { const duration = Math.max(0, block.endMs - block.startMs), chunks = Array.isArray(result?.chunks) ? result.chunks.filter((item) => item?.text?.trim()) : [], raw = chunks.length ? chunks : [{ text: result?.text || "", timestamp: [0, duration / 1000] }]; return raw.filter((item) => item.text?.trim()).map((item) => { const [rawStart, rawEnd] = item.timestamp || [], start = Number.isFinite(rawStart) ? rawStart : 0, end = Number.isFinite(rawEnd) ? rawEnd : duration / 1000, startMs = block.startMs + Math.round(Math.max(0, Math.min(start, duration / 1000)) * 1000), endMs = block.startMs + Math.round(Math.max(Math.max(0, Math.min(start, duration / 1000)), Math.min(end, duration / 1000)) * 1000); return { startMs, endMs, text: item.text.trim() }; }).filter((item) => item.endMs >= item.startMs && item.endMs <= block.endMs); }
