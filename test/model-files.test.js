import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { MemoryDirectoryAdapter } from "../src/archive.js";
import { createLargeModelCache, LARGE_MODEL_ASSETS, LARGE_MODEL_ID, LARGE_MODEL_REVISION, LARGE_MODEL_SHA256, prepareLargeModelFiles } from "../src/model-files.js";
import { buildResourcePaths } from "../node_modules/@huggingface/transformers/src/utils/hub.js";

const url = (path) => `https://huggingface.co/${LARGE_MODEL_ID}/resolve/${LARGE_MODEL_REVISION}/${path}`;
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");

test("every pinned model asset has a SHA-256 digest", () => {
  assert.deepEqual(Object.keys(LARGE_MODEL_SHA256).sort(), Object.keys(LARGE_MODEL_ASSETS).sort());
  for (const value of Object.values(LARGE_MODEL_SHA256)) assert.match(value, /^[a-f0-9]{64}$/);
});

test("model files stream into the selected directory, then serve pinned offline URLs", async () => {
  const root = new MemoryDirectoryAdapter();
  const bytes = new TextEncoder().encode('{"model_type":"whisper"}');
  const assets = { "config.json": bytes.length }, hashes = { "config.json": digest(bytes) };
  const requested = [], progress = [];
  const fetcher = async (request) => { requested.push(request); return new Response(new Blob([bytes]), { headers: { "content-length": String(bytes.length) } }); };
  await prepareLargeModelFiles(root, { assets, hashes, fetcher, onProgress: (event) => progress.push(event) });
  assert.deepEqual(requested, [url("config.json")]);
  assert.equal(progress.at(-1).completedBytes, bytes.length);
  const model = await (await root.getDirectoryHandle("modelli")).getDirectoryHandle("whisper-large-v3-turbo-q4f16");
  assert.equal((await (await model.getFileHandle("config.json")).getFile()).size, bytes.length);
  const cache = await createLargeModelCache(root, { assets, hashes });
  assert.equal(buildResourcePaths(LARGE_MODEL_ID, "config.json", { revision: LARGE_MODEL_REVISION }, cache).proposedCacheKey, url("config.json"));
  assert.equal(buildResourcePaths(LARGE_MODEL_ID, "config.json", {}, cache).proposedCacheKey, url("config.json").replace(LARGE_MODEL_REVISION, "main"));
  assert.equal(await (await cache.match(`${url("config.json")}?download=true`)).text(), new TextDecoder().decode(bytes));
  assert.equal(await (await cache.match(url("config.json").replace(LARGE_MODEL_REVISION, "main"))).text(), new TextDecoder().decode(bytes));
  assert.equal(await cache.match(url("config.json").replace(LARGE_MODEL_REVISION, "other")), undefined);
  assert.equal(await cache.match("https://other.example/config.json"), undefined);
  assert.equal(await cache.match(url("missing.json")), undefined);
  await assert.rejects(cache.put(url("config.json"), new Response("unexpected")), /download esplicito/);
  await prepareLargeModelFiles(root, { assets, hashes, fetcher: () => { throw Error("Offline retry must use saved file"); } });
});

test("partial download is never marked ready and retries from a complete file", async () => {
  const root = new MemoryDirectoryAdapter(), bytes = new TextEncoder().encode("abcdef");
  const assets = { "config.json": bytes.length }, hashes = { "config.json": digest(bytes) };
  await assert.rejects(prepareLargeModelFiles(root, { assets, hashes, fetcher: async () => new Response(new Blob([bytes.slice(0, 3)])) }), /incompleto/);
  const cache = await createLargeModelCache(root, { assets, hashes });
  assert.equal(await cache.match(url("config.json")), undefined);
  await prepareLargeModelFiles(root, { assets, hashes, fetcher: async () => new Response(new Blob([bytes])) });
  assert.equal(await (await cache.match(url("config.json"))).text(), "abcdef");
});

test("corrupted bytes and wrong remote digest are rejected without touching media", async () => {
  const root = new MemoryDirectoryAdapter(), bytes = new TextEncoder().encode("abcdef");
  const assets = { "config.json": bytes.length }, hashes = { "config.json": digest(bytes) };
  await assert.rejects(prepareLargeModelFiles(root, { assets, hashes, fetcher: async () => new Response(new Blob([new TextEncoder().encode("ghijkl")])) }), /SHA-256/);
  await prepareLargeModelFiles(root, { assets, hashes, fetcher: async () => new Response(new Blob([bytes])) });
  const model = await (await root.getDirectoryHandle("modelli")).getDirectoryHandle("whisper-large-v3-turbo-q4f16");
  model.files.set("config.json", new Blob([new TextEncoder().encode("ghijkl")]));
  const cache = await createLargeModelCache(root, { assets, hashes });
  assert.equal(await cache.match(url("config.json")), undefined);
  assert.equal(root.directories.has("sessions"), false);
});

test("a storage write that changes bytes without changing size is rejected before the manifest", async () => {
  const root = new MemoryDirectoryAdapter(), bytes = new TextEncoder().encode("abcdef");
  const models = await root.getDirectoryHandle("modelli", { create: true });
  const model = await models.getDirectoryHandle("whisper-large-v3-turbo-q4f16", { create: true });
  const originalGetFileHandle = model.getFileHandle.bind(model);
  model.getFileHandle = async (name, options) => {
    const handle = await originalGetFileHandle(name, options);
    if (name !== "config.json") return handle;
    return { ...handle, async createWritable() {
      const writer = await handle.createWritable();
      return { ...writer, async close() { await writer.close(); model.files.set(name, new Blob(["ghijkl"])); } };
    } };
  };
  const assets = { "config.json": bytes.length }, hashes = { "config.json": digest(bytes) };
  await assert.rejects(prepareLargeModelFiles(root, { assets, hashes, fetcher: async () => new Response(new Blob([bytes])) }), /SHA-256 del file salvato/);
  const manifest = JSON.parse(await (await (await model.getFileHandle("manifest.json", { create: true })).getFile()).text() || "{}");
  assert.equal(manifest.assets?.["config.json"], undefined);
});
