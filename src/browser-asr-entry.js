import { env, pipeline } from "@huggingface/transformers";
import { createLargeModelCache, LARGE_MODEL_ID, LARGE_MODEL_REVISION, prepareLargeModelFiles } from "./model-files.js";

env.backends.onnx.wasm.wasmPaths = {
  mjs: new URL("./ort-wasm-simd-threaded.asyncify.mjs", import.meta.url).href,
  wasm: new URL("./ort-wasm-simd-threaded.asyncify.wasm", import.meta.url).href,
};

export async function loadWhisper(model, options = {}) {
  const { modelDirectory, progress_callback, ...pipelineOptions } = options;
  if (model === LARGE_MODEL_ID) {
    await prepareLargeModelFiles(modelDirectory, {
      onProgress: ({ path, completedBytes, totalBytes }) => progress_callback?.({ status: "progress", file: path, progress: Math.round(completedBytes / totalBytes * 100) }),
    });
    env.customCache = await createLargeModelCache(modelDirectory);
    env.useCustomCache = true;
    env.useBrowserCache = false;
    env.allowLocalModels = true;
    env.allowRemoteModels = false;
    return pipeline("automatic-speech-recognition", model, { ...pipelineOptions, revision: LARGE_MODEL_REVISION, local_files_only: true, progress_callback });
  }
  env.customCache = null;
  env.useCustomCache = false;
  env.useBrowserCache = true;
  env.allowLocalModels = false;
  env.allowRemoteModels = true;
  return pipeline("automatic-speech-recognition", model, { ...pipelineOptions, progress_callback });
}
