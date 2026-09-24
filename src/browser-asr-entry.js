import { env, pipeline } from "@huggingface/transformers";

// The model is fetched only by the explicit Prepare button. Cache API keeps its files.
env.useBrowserCache = true;
env.backends.onnx.wasm.wasmPaths = {
  mjs: new URL("./ort-wasm-simd-threaded.asyncify.mjs", import.meta.url).href,
  wasm: new URL("./ort-wasm-simd-threaded.asyncify.wasm", import.meta.url).href,
};

export async function loadWhisper(model, options = {}) {
  return pipeline("automatic-speech-recognition", model, options);
}
