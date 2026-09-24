const SAMPLE_RATE = 16_000;
const WINDOW_SAMPLES = SAMPLE_RATE * 20;

export const BROWSER_TIERS = {
  rapido: { label: "Rapido", model: "onnx-community/whisper-base", device: "wasm", dtype: "q8", estimate: "circa 80 MB di pesi ONNX, più runtime e metadati" },
  bilanciato: { label: "Bilanciato", model: "onnx-community/whisper-small", device: "wasm", dtype: "q8", estimate: "circa 250 MB di pesi ONNX, più runtime e metadati" },
  massima: { label: "Massima qualità", model: "onnx-community/whisper-large-v3-turbo", device: "webgpu", dtype: "q4f16", estimate: "circa 563 MB di pesi ONNX; fino a circa 1 GB di cache, più runtime", gated: true },
};

export function validateLoopbackUrl(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error("Inserisci un URL completo valido."); }
  if (!["http:", "https:"].includes(url.protocol) || !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) || url.username || url.password || url.hash) {
    throw new Error("L'URL deve usare HTTP(S) su localhost, 127.0.0.1 o [::1], senza credenziali o frammento.");
  }
  if (!url.port) throw new Error("Specifica la porta del motore locale.");
  return url.href;
}

export async function preflightLocalAsr(value, fetcher = fetch) {
  const url = validateLoopbackUrl(value);
  let response;
  try { response = await fetcher(url, { method: "GET", mode: "cors", redirect: "error", cache: "no-store" }); }
  catch (error) { throw new Error(`Motore non raggiungibile o CORS negato: ${error.message}`); }
  if (!response.ok || response.type === "opaqueredirect") throw new Error(`Health del motore: HTTP ${response.status}.`);
  let info;
  try { info = await response.json(); } catch { throw new Error("Health del motore non è JSON valido."); }
  if (info.api !== "diario-local-asr" || info.version !== 1 || info.ready !== true || info.language !== "it" || !info.model || !info.accept?.includes("audio/wav") || info.timestamps !== true || !Number.isFinite(info.maxAudioBytes) || !Number.isFinite(info.maxDurationSeconds)) {
    throw new Error("Motore non compatibile, non pronto o senza modello italiano e timestamp.");
  }
  return { url, info };
}

export function wavPcm16(samples) {
  const bytes = new ArrayBuffer(44 + samples.length * 2), view = new DataView(bytes);
  const word = (offset, value) => { for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i)); };
  word(0, "RIFF"); view.setUint32(4, bytes.byteLength - 8, true); word(8, "WAVEfmt "); view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); view.setUint16(22, 1, true); view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  word(36, "data"); view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) { const sample = Math.max(-1, Math.min(1, samples[i])); view.setInt16(44 + i * 2, sample < 0 ? sample * 32768 : sample * 32767, true); }
  return new Blob([bytes], { type: "audio/wav" });
}

export function contiguousMedia(chunks) {
  const ordered = chunks.filter((chunk) => chunk.stored && chunk.bytes > 0).sort((a, b) => a.index - b.index);
  if (!ordered.length || ordered[0].index !== 0) throw new Error("Manca il frammento iniziale con header: audio non elaborabile.");
  const included = [];
  for (const chunk of ordered) { if (chunk.index !== included.length || chunk.format !== ordered[0].format) break; included.push(chunk); }
  return { chunks: included, partial: included.length !== chunks.length, format: included[0].format };
}

export function normalizeSegments(response, windowStartMs, durationMs) {
  if (!Array.isArray(response.segments)) throw new Error("La risposta ASR non contiene segmenti.");
  const result = [];
  for (const segment of response.segments) {
    if (!segment.text?.trim()) continue;
    const start = Number(segment.start), end = Number(segment.end);
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end < start || end * 1000 > durationMs) throw new Error("Timestamp ASR fuori dall'audio inviato.");
    result.push({ startMs: windowStartMs + Math.round(start * 1000), endMs: windowStartMs + Math.round(end * 1000), text: segment.text.trim(), timed: true });
  }
  return result;
}

export function normalizeBrowserResult(result, windowStartMs, durationMs) {
  const chunks = Array.isArray(result?.chunks) ? result.chunks : [];
  const timed = [], untimed = [];
  for (const chunk of chunks) {
    if (!chunk.text?.trim()) continue;
    const [start, end] = chunk.timestamp || [];
    if (start == null || end == null) untimed.push({ startMs: null, endMs: null, text: chunk.text.trim(), timed: false });
    else timed.push({ start, end, text: chunk.text });
  }
  const normalized = [...normalizeSegments({ segments: timed }, windowStartMs, durationMs), ...untimed];
  if (!normalized.length && result?.text?.trim()) normalized.push({ startMs: null, endMs: null, text: result.text.trim(), timed: false });
  return normalized;
}

export async function transcribeLocal({ url, info }, samples, signal, fetcher = fetch) {
  const audio = wavPcm16(samples);
  if (audio.size > info.maxAudioBytes || samples.length / SAMPLE_RATE > info.maxDurationSeconds) throw new Error("Finestra audio oltre il limite dichiarato dal motore.");
  const body = new FormData(); body.append("audio", audio, "audio.wav"); body.append("language", "it");
  let response;
  try { response = await fetcher(url, { method: "POST", mode: "cors", redirect: "error", cache: "no-store", body, signal }); }
  catch (error) { if (signal?.aborted) throw error; throw new Error(`Invio audio al loopback fallito: ${error.message}`); }
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error?.message || `Motore: HTTP ${response.status}`);
  if (payload?.api !== "diario-local-asr" || payload.version !== 1 || payload.language !== "it" || !Array.isArray(payload.segments)) throw new Error("Risposta del motore incompatibile.");
  return payload;
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const update = (buffer, operation) => new Promise((resolve, reject) => { const timeout = setTimeout(() => { cleanup(); reject(new Error("Buffer media fermo oltre 20 secondi.")); }, 20_000); const done = () => { cleanup(); resolve(); }, fail = () => { cleanup(); reject(new Error("Errore del buffer media.")); }, cleanup = () => { clearTimeout(timeout); buffer.removeEventListener("updateend", done); buffer.removeEventListener("error", fail); }; buffer.addEventListener("updateend", done, { once: true }); buffer.addEventListener("error", fail, { once: true }); try { operation(); } catch (error) { cleanup(); reject(error); } });

// MSE holds a moving media window. The browser decodes the audio track, including
// legacy video, while the original files are read one fragment at a time.
export async function* audioWindows(archive, media, signal, { windowSamples = WINDOW_SAMPLES } = {}) {
  if (!globalThis.MediaSource?.isTypeSupported(media.format)) throw new Error(`Formato ${media.format} non supportato da MediaSource su questo browser.`);
  const source = new MediaSource(), url = URL.createObjectURL(source), element = document.createElement("video");
  element.playsInline = true; element.preload = "auto"; element.style.display = "none"; element.src = url; document.body.append(element);
  const context = new AudioContext(), node = context.createMediaElementSource(element), processor = context.createScriptProcessor(4096, 2, 1);
  node.connect(processor); processor.connect(context.destination);
  let pcm = [], decoded = 0, phase = 0, previous = 0, ended = false, endedAt = 0, playError = null, mediaError = null;
  processor.onaudioprocess = (event) => {
    const output = event.outputBuffer.getChannelData(0); output.fill(0);
    if ((element.paused && !element.ended) || element.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
    const channels = Array.from({ length: event.inputBuffer.numberOfChannels }, (_, index) => event.inputBuffer.getChannelData(index));
    if (element.ended && channels.every((channel) => channel.every((sample) => Math.abs(sample) < 0.000001))) return;
    const ratio = SAMPLE_RATE / context.sampleRate;
    for (let i = 0; i < channels[0].length; i++) { const sample = channels.reduce((sum, channel) => sum + channel[i], 0) / channels.length; phase += ratio; if (phase >= 1) { pcm.push((previous + sample) / 2); phase -= 1; } previous = sample; }
  };
  element.addEventListener("ended", () => { ended = true; endedAt = performance.now(); });
  element.addEventListener("error", () => { mediaError = new Error(`Decodifica media fallita (${element.error?.code || "sconosciuto"}).`); });
  try {
    await new Promise((resolve, reject) => { source.addEventListener("sourceopen", resolve, { once: true }); source.addEventListener("error", () => reject(new Error("Impossibile aprire MediaSource.")), { once: true }); });
    const buffer = source.addSourceBuffer(media.format); buffer.mode = "sequence";
    let next = 0, started = false, lastProgressAt = performance.now(), lastTime = 0, lastPcm = 0, lastNext = 0;
    while (!ended || pcm.length || performance.now() - endedAt < 400) {
      if (signal?.aborted) throw new DOMException("Trascrizione annullata", "AbortError");
      if (playError) throw playError;
      if (mediaError) throw mediaError;
      if (element.currentTime > lastTime || pcm.length !== lastPcm || next !== lastNext) { lastProgressAt = performance.now(); lastTime = element.currentTime; lastPcm = pcm.length; lastNext = next; }
      if (performance.now() - lastProgressAt > 20_000) throw new Error("Decodifica media senza avanzamento per oltre 20 secondi.");
      const bufferedEnd = buffer.buffered.length ? buffer.buffered.end(buffer.buffered.length - 1) : 0;
      if (next < media.chunks.length && (!started || bufferedEnd < element.currentTime + 35)) {
        const chunk = media.chunks[next++], file = await archive.readFragment(chunk), bytes = await file.arrayBuffer();
        await update(buffer, () => buffer.appendBuffer(bytes));
      }
      if (!started && buffer.buffered.length) { await context.resume(); element.play().catch((error) => { playError = error; }); started = true; }
      if (next === media.chunks.length && source.readyState === "open" && !buffer.updating) source.endOfStream();
      if (buffer.buffered.length && element.currentTime > 50 && buffer.buffered.start(0) < element.currentTime - 30 && !buffer.updating && source.readyState === "open") await update(buffer, () => buffer.remove(0, element.currentTime - 30));
      if (pcm.length >= windowSamples || (ended && pcm.length && performance.now() - endedAt >= 400)) {
        element.pause();
        const count = Math.min(windowSamples, pcm.length), samples = Float32Array.from(pcm.splice(0, count));
        const startMs = media.chunks[0].startMs + Math.round(decoded / SAMPLE_RATE * 1000); decoded += count;
        yield { samples, startMs, endMs: media.chunks[0].startMs + Math.round(decoded / SAMPLE_RATE * 1000), mediaChunkIds: media.chunks.filter((chunk) => chunk.endMs > startMs && chunk.startMs < media.chunks[0].startMs + decoded / SAMPLE_RATE * 1000).map((chunk) => chunk.id) };
        if (!ended) element.play().catch((error) => { playError = error; });
      } else await wait(100);
    }
  } finally { element.pause(); processor.disconnect(); node.disconnect(); await context.close(); element.remove(); URL.revokeObjectURL(url); }
}
