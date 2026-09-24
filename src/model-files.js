import { sha256 } from "@noble/hashes/sha2.js";

export const LARGE_MODEL_ID = "onnx-community/whisper-large-v3-turbo";
export const LARGE_MODEL_REVISION = "360ebcde2559d60bb474678be3c1de9ef347d01a";
export const LARGE_MODEL_ASSETS = Object.freeze({
  "added_tokens.json": 34648,
  "config.json": 1332,
  "generation_config.json": 3897,
  "merges.txt": 493869,
  "normalizer.json": 52666,
  "preprocessor_config.json": 340,
  "quantize_config.json": 285,
  "special_tokens_map.json": 2186,
  "tokenizer.json": 2480617,
  "tokenizer_config.json": 282843,
  "vocab.json": 1036558,
  "onnx/encoder_model_q4f16.onnx": 369974078,
  "onnx/decoder_model_merged_q4f16.onnx": 193505017,
});
// SHA-256 of every asset at the pinned revision; ONNX values match the published LFS objects.
export const LARGE_MODEL_SHA256 = Object.freeze({
  "added_tokens.json": "3c51f66c4c21f9e126970078f11ae77a78c74aee8df606ee9daba86e467108e0",
  "config.json": "35cd83669f75bc2867f3b3a4461850392d5e308cd6ea951c3700539883c28df1",
  "generation_config.json": "16f95291d2f47c944d3c2b19390bba7965666555c1ea2a0bdc850d1fab45612f",
  "merges.txt": "2df2990a395e35e8dfbc7511e08c12d56018d8d04691e0133e5d63b21e154dc6",
  "normalizer.json": "bf1c507dc8724ca9cf9903640dacfb69dae2f00edee4f21ceba106a7392f26dd",
  "preprocessor_config.json": "7ccc62c6f2765af1f3b46c00c9b5894426835a05021c8b9c01eecb6dfb542711",
  "quantize_config.json": "8da6e4e50ef7c210ba66a98a4256e6d60e38cef8a9a9c74d327251aaf4e78767",
  "special_tokens_map.json": "baea4ea09372eb4fca86b4e4346139fd73cb807d5087e9de0948e971739c3e74",
  "tokenizer.json": "6d8cbd7cd0d8d5815e478dac67b85a26bbe77c1f5e0c6d76d1ce2abc0e5f21ca",
  "tokenizer_config.json": "844b642c73a91359722f47b35705f7174686df33d252695d8572cf9ac03a6389",
  "vocab.json": "e2aa043ef015641d363d8288e7c241c85e36a5c761fb303598e0710233344387",
  "onnx/encoder_model_q4f16.onnx": "aafd3383f1aa372db0825a885730ebbbae7e34871ec0460428663c69641a63d0",
  "onnx/decoder_model_merged_q4f16.onnx": "45981cdd958a4c8e1447839850d2e6e27e30974ccbe31b4a1e5ebe9ad8965a5f",
});

const MODEL_FOLDER = "whisper-large-v3-turbo-q4f16";
const MANIFEST_NAME = "manifest.json";
const modelUrl = (path, revision = LARGE_MODEL_REVISION) => `https://huggingface.co/${LARGE_MODEL_ID}/resolve/${revision}/${path}`;
const totalBytes = (assets) => Object.values(assets).reduce((sum, size) => sum + size, 0);
const hex = (bytes) => Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");

async function hashStream(stream) {
  const digest = sha256.create(), reader = stream.getReader();
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    digest.update(value);
  }
  return hex(digest.digest());
}

async function modelDirectory(root) {
  if (!root?.getDirectoryHandle) throw new Error("Collega una cartella archivio prima di preparare il modello.");
  const models = await root.getDirectoryHandle("modelli", { create: true });
  return models.getDirectoryHandle(MODEL_FOLDER, { create: true });
}

async function fileAt(root, path, create = false) {
  const parts = path.split("/");
  let directory = root;
  for (const part of parts.slice(0, -1)) directory = await directory.getDirectoryHandle(part, { create });
  return directory.getFileHandle(parts.at(-1), { create });
}

async function readManifest(directory) {
  try {
    const file = await (await directory.getFileHandle(MANIFEST_NAME)).getFile();
    const parsed = JSON.parse(await file.text());
    if (parsed.schemaVersion === 1 && parsed.model === LARGE_MODEL_ID && parsed.revision === LARGE_MODEL_REVISION && parsed.assets && typeof parsed.assets === "object") return parsed;
  } catch {}
  return { schemaVersion: 1, model: LARGE_MODEL_ID, revision: LARGE_MODEL_REVISION, assets: {} };
}

async function writeManifest(directory, manifest) {
  const handle = await directory.getFileHandle(MANIFEST_NAME, { create: true });
  const writer = await handle.createWritable();
  await writer.write(JSON.stringify(manifest, null, 2));
  await writer.close();
}

async function verifiedFile(directory, manifest, path, expectedSize, hashes) {
  if (manifest.assets[path] !== expectedSize) return null;
  try {
    const file = await (await fileAt(directory, path)).getFile();
    if (file.size !== expectedSize) return null;
    const expectedHash = hashes[path];
    if (expectedHash && await hashStream(file.stream()) !== expectedHash) return null;
    return file;
  } catch { return null; }
}

async function downloadFile(directory, path, expectedSize, fetcher, onProgress, alreadyLoaded, total, signal, hashes) {
  const response = await fetcher(modelUrl(path), { cache: "no-store", signal });
  if (!response.ok || !response.body) throw new Error(`Download ${path}: HTTP ${response.status}.`);
  const contentLength = Number(response.headers.get("content-length"));
  if (contentLength > 0 && contentLength !== expectedSize) throw new Error(`Dimensione remota di ${path} diversa dalla revisione fissata.`);
  const handle = await fileAt(directory, path, true), writer = await handle.createWritable(), reader = response.body.getReader();
  let loaded = 0;
  const digest = hashes[path] ? sha256.create() : null;
  try {
    while (true) {
      if (signal?.aborted) throw new DOMException("Download annullato", "AbortError");
      const { value, done } = await reader.read();
      if (done) break;
      if (!(value instanceof Uint8Array) || !value.length) continue;
      if (loaded + value.length > expectedSize) throw new Error(`File ${path} supera la dimensione attesa.`);
      digest?.update(value);
      await writer.write({ type: "write", position: loaded, data: new Blob([value]) });
      loaded += value.length;
      onProgress?.({ path, loaded, expectedSize, completedBytes: alreadyLoaded + loaded, totalBytes: total });
    }
    if (loaded !== expectedSize) throw new Error(`File ${path} incompleto: ${loaded}/${expectedSize} byte.`);
    if (digest && hex(digest.digest()) !== hashes[path]) throw new Error(`SHA-256 di ${path} diverso dalla revisione fissata.`);
    await writer.close();
    const saved = await handle.getFile();
    if (saved.size !== expectedSize) throw new Error(`Verifica file ${path} fallita dopo la scrittura.`);
    if (hashes[path] && await hashStream(saved.stream()) !== hashes[path]) throw new Error(`SHA-256 del file salvato ${path} diverso dalla revisione fissata.`);
  } catch (error) {
    await reader.cancel().catch(() => {});
    await writer.abort?.().catch(() => {});
    throw error;
  }
}

export async function prepareLargeModelFiles(root, { fetcher = fetch, onProgress = () => {}, assets = LARGE_MODEL_ASSETS, hashes = LARGE_MODEL_SHA256, signal } = {}) {
  const directory = await modelDirectory(root), manifest = await readManifest(directory), total = totalBytes(assets);
  let completed = 0;
  for (const [path, expectedSize] of Object.entries(assets)) {
    if (signal?.aborted) throw new DOMException("Download annullato", "AbortError");
    if (!Number.isSafeInteger(expectedSize) || expectedSize <= 0 || !/^(?:onnx\/)?[a-zA-Z0-9_.-]+$/.test(path)) throw new Error("Manifest modello non valido.");
    if (await verifiedFile(directory, manifest, path, expectedSize, hashes)) { completed += expectedSize; onProgress({ path, loaded: expectedSize, expectedSize, completedBytes: completed, totalBytes: total, cached: true }); continue; }
    await downloadFile(directory, path, expectedSize, fetcher, onProgress, completed, total, signal, hashes);
    manifest.assets[path] = expectedSize;
    await writeManifest(directory, manifest);
    completed += expectedSize;
  }
  return { directory, totalBytes: total, assetCount: Object.keys(assets).length };
}

export async function createLargeModelCache(root, { assets = LARGE_MODEL_ASSETS, hashes = LARGE_MODEL_SHA256 } = {}) {
  const directory = await modelDirectory(root);
  return {
    async match(request) {
      const prefixes = [LARGE_MODEL_REVISION, "main"].map((revision) => `/${LARGE_MODEL_ID}/resolve/${revision}/`);
      let url;
      try { url = new URL(typeof request === "string" ? request : request?.url); } catch { return undefined; }
      if (url.origin !== "https://huggingface.co") return undefined;
      const prefix = prefixes.find((candidate) => url.pathname.startsWith(candidate));
      if (!prefix) return undefined;
      const path = decodeURIComponent(url.pathname.slice(prefix.length));
      const expectedSize = assets[path];
      if (!expectedSize) return undefined;
      const manifest = await readManifest(directory), file = await verifiedFile(directory, manifest, path, expectedSize, hashes);
      return file ? new Response(file.stream(), { headers: { "content-length": String(file.size), "content-type": path.endsWith(".json") ? "application/json" : "application/octet-stream" } }) : undefined;
    },
    async put(request) {
      // ONNX Runtime also uses the global cache hook for its own bundled WASM files.
      // They remain served by this app; only model weights belong in the chosen folder.
      let url;
      try { url = new URL(typeof request === "string" ? request : request?.url, globalThis.location?.href); } catch {}
      if (url?.origin === globalThis.location?.origin && /\/ort-wasm-simd-threaded\.asyncify\.(?:wasm|mjs)$/.test(url.pathname)) return;
      throw new Error("I file del modello massimo si preparano solo con download esplicito nella cartella scelta.");
    },
  };
}
