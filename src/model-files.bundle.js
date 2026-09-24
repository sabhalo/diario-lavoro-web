// node_modules/@noble/hashes/utils.js
function isBytes(a) {
  return a instanceof Uint8Array || ArrayBuffer.isView(a) && a.constructor.name === "Uint8Array";
}
function abytes(value, length, title = "") {
  const bytes = isBytes(value);
  const len = value?.length;
  const needsLen = length !== void 0;
  if (!bytes || needsLen && len !== length) {
    const prefix = title && `"${title}" `;
    const ofLen = needsLen ? ` of length ${length}` : "";
    const got = bytes ? `length=${len}` : `type=${typeof value}`;
    throw new Error(prefix + "expected Uint8Array" + ofLen + ", got " + got);
  }
  return value;
}
function aexists(instance, checkFinished = true) {
  if (instance.destroyed)
    throw new Error("Hash instance has been destroyed");
  if (checkFinished && instance.finished)
    throw new Error("Hash#digest() has already been called");
}
function aoutput(out, instance) {
  abytes(out, void 0, "digestInto() output");
  const min = instance.outputLen;
  if (out.length < min) {
    throw new Error('"digestInto() output" expected to be of length >=' + min);
  }
}
function clean(...arrays) {
  for (let i = 0; i < arrays.length; i++) {
    arrays[i].fill(0);
  }
}
function createView(arr) {
  return new DataView(arr.buffer, arr.byteOffset, arr.byteLength);
}
function rotr(word, shift) {
  return word << 32 - shift | word >>> shift;
}
function createHasher(hashCons, info = {}) {
  const hashC = (msg, opts) => hashCons(opts).update(msg).digest();
  const tmp = hashCons(void 0);
  hashC.outputLen = tmp.outputLen;
  hashC.blockLen = tmp.blockLen;
  hashC.create = (opts) => hashCons(opts);
  Object.assign(hashC, info);
  return Object.freeze(hashC);
}
var oidNist = (suffix) => ({
  oid: Uint8Array.from([6, 9, 96, 134, 72, 1, 101, 3, 4, 2, suffix])
});

// node_modules/@noble/hashes/_md.js
function Chi(a, b, c) {
  return a & b ^ ~a & c;
}
function Maj(a, b, c) {
  return a & b ^ a & c ^ b & c;
}
var HashMD = class {
  blockLen;
  outputLen;
  padOffset;
  isLE;
  // For partial updates less than block size
  buffer;
  view;
  finished = false;
  length = 0;
  pos = 0;
  destroyed = false;
  constructor(blockLen, outputLen, padOffset, isLE) {
    this.blockLen = blockLen;
    this.outputLen = outputLen;
    this.padOffset = padOffset;
    this.isLE = isLE;
    this.buffer = new Uint8Array(blockLen);
    this.view = createView(this.buffer);
  }
  update(data) {
    aexists(this);
    abytes(data);
    const { view, buffer, blockLen } = this;
    const len = data.length;
    for (let pos = 0; pos < len; ) {
      const take = Math.min(blockLen - this.pos, len - pos);
      if (take === blockLen) {
        const dataView = createView(data);
        for (; blockLen <= len - pos; pos += blockLen)
          this.process(dataView, pos);
        continue;
      }
      buffer.set(data.subarray(pos, pos + take), this.pos);
      this.pos += take;
      pos += take;
      if (this.pos === blockLen) {
        this.process(view, 0);
        this.pos = 0;
      }
    }
    this.length += data.length;
    this.roundClean();
    return this;
  }
  digestInto(out) {
    aexists(this);
    aoutput(out, this);
    this.finished = true;
    const { buffer, view, blockLen, isLE } = this;
    let { pos } = this;
    buffer[pos++] = 128;
    clean(this.buffer.subarray(pos));
    if (this.padOffset > blockLen - pos) {
      this.process(view, 0);
      pos = 0;
    }
    for (let i = pos; i < blockLen; i++)
      buffer[i] = 0;
    view.setBigUint64(blockLen - 8, BigInt(this.length * 8), isLE);
    this.process(view, 0);
    const oview = createView(out);
    const len = this.outputLen;
    if (len % 4)
      throw new Error("_sha2: outputLen must be aligned to 32bit");
    const outLen = len / 4;
    const state = this.get();
    if (outLen > state.length)
      throw new Error("_sha2: outputLen bigger than state");
    for (let i = 0; i < outLen; i++)
      oview.setUint32(4 * i, state[i], isLE);
  }
  digest() {
    const { buffer, outputLen } = this;
    this.digestInto(buffer);
    const res = buffer.slice(0, outputLen);
    this.destroy();
    return res;
  }
  _cloneInto(to) {
    to ||= new this.constructor();
    to.set(...this.get());
    const { blockLen, buffer, length, finished, destroyed, pos } = this;
    to.destroyed = destroyed;
    to.finished = finished;
    to.length = length;
    to.pos = pos;
    if (length % blockLen)
      to.buffer.set(buffer);
    return to;
  }
  clone() {
    return this._cloneInto();
  }
};
var SHA256_IV = /* @__PURE__ */ Uint32Array.from([
  1779033703,
  3144134277,
  1013904242,
  2773480762,
  1359893119,
  2600822924,
  528734635,
  1541459225
]);

// node_modules/@noble/hashes/sha2.js
var SHA256_K = /* @__PURE__ */ Uint32Array.from([
  1116352408,
  1899447441,
  3049323471,
  3921009573,
  961987163,
  1508970993,
  2453635748,
  2870763221,
  3624381080,
  310598401,
  607225278,
  1426881987,
  1925078388,
  2162078206,
  2614888103,
  3248222580,
  3835390401,
  4022224774,
  264347078,
  604807628,
  770255983,
  1249150122,
  1555081692,
  1996064986,
  2554220882,
  2821834349,
  2952996808,
  3210313671,
  3336571891,
  3584528711,
  113926993,
  338241895,
  666307205,
  773529912,
  1294757372,
  1396182291,
  1695183700,
  1986661051,
  2177026350,
  2456956037,
  2730485921,
  2820302411,
  3259730800,
  3345764771,
  3516065817,
  3600352804,
  4094571909,
  275423344,
  430227734,
  506948616,
  659060556,
  883997877,
  958139571,
  1322822218,
  1537002063,
  1747873779,
  1955562222,
  2024104815,
  2227730452,
  2361852424,
  2428436474,
  2756734187,
  3204031479,
  3329325298
]);
var SHA256_W = /* @__PURE__ */ new Uint32Array(64);
var SHA2_32B = class extends HashMD {
  constructor(outputLen) {
    super(64, outputLen, 8, false);
  }
  get() {
    const { A, B, C, D, E, F, G, H } = this;
    return [A, B, C, D, E, F, G, H];
  }
  // prettier-ignore
  set(A, B, C, D, E, F, G, H) {
    this.A = A | 0;
    this.B = B | 0;
    this.C = C | 0;
    this.D = D | 0;
    this.E = E | 0;
    this.F = F | 0;
    this.G = G | 0;
    this.H = H | 0;
  }
  process(view, offset) {
    for (let i = 0; i < 16; i++, offset += 4)
      SHA256_W[i] = view.getUint32(offset, false);
    for (let i = 16; i < 64; i++) {
      const W15 = SHA256_W[i - 15];
      const W2 = SHA256_W[i - 2];
      const s0 = rotr(W15, 7) ^ rotr(W15, 18) ^ W15 >>> 3;
      const s1 = rotr(W2, 17) ^ rotr(W2, 19) ^ W2 >>> 10;
      SHA256_W[i] = s1 + SHA256_W[i - 7] + s0 + SHA256_W[i - 16] | 0;
    }
    let { A, B, C, D, E, F, G, H } = this;
    for (let i = 0; i < 64; i++) {
      const sigma1 = rotr(E, 6) ^ rotr(E, 11) ^ rotr(E, 25);
      const T1 = H + sigma1 + Chi(E, F, G) + SHA256_K[i] + SHA256_W[i] | 0;
      const sigma0 = rotr(A, 2) ^ rotr(A, 13) ^ rotr(A, 22);
      const T2 = sigma0 + Maj(A, B, C) | 0;
      H = G;
      G = F;
      F = E;
      E = D + T1 | 0;
      D = C;
      C = B;
      B = A;
      A = T1 + T2 | 0;
    }
    A = A + this.A | 0;
    B = B + this.B | 0;
    C = C + this.C | 0;
    D = D + this.D | 0;
    E = E + this.E | 0;
    F = F + this.F | 0;
    G = G + this.G | 0;
    H = H + this.H | 0;
    this.set(A, B, C, D, E, F, G, H);
  }
  roundClean() {
    clean(SHA256_W);
  }
  destroy() {
    this.set(0, 0, 0, 0, 0, 0, 0, 0);
    clean(this.buffer);
  }
};
var _SHA256 = class extends SHA2_32B {
  // We cannot use array here since array allows indexing by variable
  // which means optimizer/compiler cannot use registers.
  A = SHA256_IV[0] | 0;
  B = SHA256_IV[1] | 0;
  C = SHA256_IV[2] | 0;
  D = SHA256_IV[3] | 0;
  E = SHA256_IV[4] | 0;
  F = SHA256_IV[5] | 0;
  G = SHA256_IV[6] | 0;
  H = SHA256_IV[7] | 0;
  constructor() {
    super(32);
  }
};
var sha256 = /* @__PURE__ */ createHasher(
  () => new _SHA256(),
  /* @__PURE__ */ oidNist(1)
);

// src/model-files.js
var LARGE_MODEL_ID = "onnx-community/whisper-large-v3-turbo";
var LARGE_MODEL_REVISION = "360ebcde2559d60bb474678be3c1de9ef347d01a";
var LARGE_MODEL_ASSETS = Object.freeze({
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
  "onnx/decoder_model_merged_q4f16.onnx": 193505017
});
var LARGE_MODEL_SHA256 = Object.freeze({
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
  "onnx/decoder_model_merged_q4f16.onnx": "45981cdd958a4c8e1447839850d2e6e27e30974ccbe31b4a1e5ebe9ad8965a5f"
});
var MODEL_FOLDER = "whisper-large-v3-turbo-q4f16";
var MANIFEST_NAME = "manifest.json";
var modelUrl = (path, revision = LARGE_MODEL_REVISION) => `https://huggingface.co/${LARGE_MODEL_ID}/resolve/${revision}/${path}`;
var totalBytes = (assets) => Object.values(assets).reduce((sum, size) => sum + size, 0);
var hex = (bytes) => Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
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
  } catch {
  }
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
  } catch {
    return null;
  }
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
    await reader.cancel().catch(() => {
    });
    await writer.abort?.().catch(() => {
    });
    throw error;
  }
}
async function prepareLargeModelFiles(root, { fetcher = fetch, onProgress = () => {
}, assets = LARGE_MODEL_ASSETS, hashes = LARGE_MODEL_SHA256, signal } = {}) {
  const directory = await modelDirectory(root), manifest = await readManifest(directory), total = totalBytes(assets);
  let completed = 0;
  for (const [path, expectedSize] of Object.entries(assets)) {
    if (signal?.aborted) throw new DOMException("Download annullato", "AbortError");
    if (!Number.isSafeInteger(expectedSize) || expectedSize <= 0 || !/^(?:onnx\/)?[a-zA-Z0-9_.-]+$/.test(path)) throw new Error("Manifest modello non valido.");
    if (await verifiedFile(directory, manifest, path, expectedSize, hashes)) {
      completed += expectedSize;
      onProgress({ path, loaded: expectedSize, expectedSize, completedBytes: completed, totalBytes: total, cached: true });
      continue;
    }
    await downloadFile(directory, path, expectedSize, fetcher, onProgress, completed, total, signal, hashes);
    manifest.assets[path] = expectedSize;
    await writeManifest(directory, manifest);
    completed += expectedSize;
  }
  return { directory, totalBytes: total, assetCount: Object.keys(assets).length };
}
async function createLargeModelCache(root, { assets = LARGE_MODEL_ASSETS, hashes = LARGE_MODEL_SHA256 } = {}) {
  const directory = await modelDirectory(root);
  return {
    async match(request) {
      const prefixes = [LARGE_MODEL_REVISION, "main"].map((revision) => `/${LARGE_MODEL_ID}/resolve/${revision}/`);
      let url;
      try {
        url = new URL(typeof request === "string" ? request : request?.url);
      } catch {
        return void 0;
      }
      if (url.origin !== "https://huggingface.co") return void 0;
      const prefix = prefixes.find((candidate) => url.pathname.startsWith(candidate));
      if (!prefix) return void 0;
      const path = decodeURIComponent(url.pathname.slice(prefix.length));
      const expectedSize = assets[path];
      if (!expectedSize) return void 0;
      const manifest = await readManifest(directory), file = await verifiedFile(directory, manifest, path, expectedSize, hashes);
      return file ? new Response(file.stream(), { headers: { "content-length": String(file.size), "content-type": path.endsWith(".json") ? "application/json" : "application/octet-stream" } }) : void 0;
    },
    async put(request) {
      let url;
      try {
        url = new URL(typeof request === "string" ? request : request?.url, globalThis.location?.href);
      } catch {
      }
      if (url?.origin === globalThis.location?.origin && /\/ort-wasm-simd-threaded\.asyncify\.(?:wasm|mjs)$/.test(url.pathname)) return;
      throw new Error("I file del modello massimo si preparano solo con download esplicito nella cartella scelta.");
    }
  };
}
export {
  LARGE_MODEL_ASSETS,
  LARGE_MODEL_ID,
  LARGE_MODEL_REVISION,
  LARGE_MODEL_SHA256,
  createLargeModelCache,
  prepareLargeModelFiles
};
/*! Bundled license information:

@noble/hashes/utils.js:
  (*! noble-hashes - MIT License (c) 2022 Paul Miller (paulmillr.com) *)
*/
