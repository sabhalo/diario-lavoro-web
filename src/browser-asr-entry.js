import { env, pipeline } from "@huggingface/transformers";

// The model is fetched only by the explicit Prepare button. Cache API keeps its files.
env.useBrowserCache = true;
const nativeFetch = globalThis.fetch.bind(globalThis);
const LARGE_ENCODER = /^https:\/\/huggingface\.co\/onnx-community\/whisper-large-v3-turbo\/resolve\/[^/]+\/onnx\/encoder_model_q4f16\.onnx(?:\?.*)?$/;
const LARGE_CACHE = "diario-asr-large-encoder-v1";
const PART_BYTES = 16 * 1024 * 1024;
let progressCallback = null;

async function chunkedEncoderResponse(url, options) {
  const base = `${globalThis.location.origin}/diario-model-cache/large-encoder-v1/`;
  let cache = await caches.open(LARGE_CACHE);
  const manifestResponse = await cache.match(`${base}manifest.json`);
  let manifest = manifestResponse && await manifestResponse.json().catch(() => null);
  if (manifest?.url !== url || !Number.isSafeInteger(manifest.total) || !Number.isSafeInteger(manifest.parts) || manifest.total <= 0 || manifest.parts <= 0 || !(await Promise.all(Array.from({ length: manifest.parts }, (_, i) => cache.match(`${base}${i}`)))).every(Boolean)) {
    await caches.delete(LARGE_CACHE);
    cache = await caches.open(LARGE_CACHE);
    const response = await nativeFetch(url, options);
    if (!response.ok || !response.body) return response;
    const reader = response.body.getReader();
    let pending = new Uint8Array(PART_BYTES), filled = 0, total = 0, parts = 0;
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        for (let offset = 0; offset < value.length;) {
          const count = Math.min(PART_BYTES - filled, value.length - offset);
          pending.set(value.subarray(offset, offset + count), filled);
          filled += count; offset += count; total += count;
          if (filled === PART_BYTES) {
            await cache.put(`${base}${parts++}`, new Response(pending));
            pending = new Uint8Array(PART_BYTES); filled = 0;
          }
        }
        const expected = Number(response.headers.get("content-length"));
        if (expected > 0) progressCallback?.({ status: "progress", file: "encoder_model_q4f16.onnx", progress: Math.min(100, total / expected * 100) });
      }
      if (filled) await cache.put(`${base}${parts++}`, new Response(pending.subarray(0, filled)));
      const expected = Number(response.headers.get("content-length"));
      if (!total || (expected > 0 && total !== expected)) throw new Error("Download del modello incompleto.");
      manifest = { url, total, parts };
      await cache.put(`${base}manifest.json`, new Response(JSON.stringify(manifest), { headers: { "content-type": "application/json" } }));
    } catch (error) {
      await caches.delete(LARGE_CACHE);
      throw error;
    }
  }
  let next = 0;
  return new Response(new ReadableStream({
    async pull(controller) {
      if (next === manifest.parts) { controller.close(); return; }
      const part = await cache.match(`${base}${next++}`);
      if (!part) { controller.error(new Error("Cache del modello incompleta.")); return; }
      controller.enqueue(new Uint8Array(await part.arrayBuffer()));
    },
  }), { headers: { "content-length": String(manifest.total), "content-type": "application/octet-stream" } });
}

env.fetch = (url, options) => LARGE_ENCODER.test(String(url)) && globalThis.caches ? chunkedEncoderResponse(String(url), options) : nativeFetch(url, options);
env.backends.onnx.wasm.wasmPaths = {
  mjs: new URL("./ort-wasm-simd-threaded.asyncify.mjs", import.meta.url).href,
  wasm: new URL("./ort-wasm-simd-threaded.asyncify.wasm", import.meta.url).href,
};

export async function loadWhisper(model, options = {}) {
  progressCallback = options.progress_callback || null;
  try { return await pipeline("automatic-speech-recognition", model, options); }
  finally { progressCallback = null; }
}
