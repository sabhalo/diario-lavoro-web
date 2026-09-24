import test from "node:test";
import assert from "node:assert/strict";
import { BROWSER_TIERS, contiguousMedia, normalizeBrowserResult, normalizeSegments, preflightLocalAsr, transcribeLocal, validateLoopbackUrl, wavPcm16 } from "../src/asr.js";

const capability = { api: "diario-local-asr", version: 1, ready: true, language: "it", model: "ggml-large-v3-turbo-q5_0.bin", accept: ["audio/wav"], maxAudioBytes: 20_000_000, maxDurationSeconds: 600, timestamps: true };

test("only complete loopback URLs with explicit port pass validation", () => {
  assert.equal(validateLoopbackUrl("http://127.0.0.1:8765/asr"), "http://127.0.0.1:8765/asr");
  assert.equal(validateLoopbackUrl("http://[::1]:8765/asr"), "http://[::1]:8765/asr");
  for (const url of ["https://example.com/asr", "http://192.168.1.2:8765/asr", "http://localhost/asr", "http://user:pass@localhost:8765/asr", "http://localhost:8765/asr#fragment"]) assert.throws(() => validateLoopbackUrl(url));
});

test("preflight requires adapter identity, Italian model, audio contract and timing", async () => {
  const calls = [];
  const fetcher = async (url, options) => { calls.push({ url, options }); return { ok: true, status: 200, json: async () => capability }; };
  const result = await preflightLocalAsr("http://localhost:8765/custom/asr", fetcher);
  assert.equal(result.url, "http://localhost:8765/custom/asr");
  assert.equal(calls[0].options.redirect, "error");
  assert.equal(calls[0].options.method, "GET");
  await assert.rejects(preflightLocalAsr("http://localhost:8765/asr", async () => ({ ok: true, json: async () => ({ ...capability, timestamps: false }) })), /non compatibile/);
});

test("POST contains only mono PCM WAV and Italian language on the exact configured URL", async () => {
  let sent;
  const fetcher = async (url, options) => { sent = { url, options }; return { ok: true, json: async () => ({ api: capability.api, version: 1, language: "it", model: capability.model, segments: [{ start: 0, end: 0.01, text: "ciao" }] }) }; };
  const url = "http://127.0.0.1:8765/custom/asr";
  await transcribeLocal({ url, info: capability }, new Float32Array(160), new AbortController().signal, fetcher);
  assert.equal(sent.url, url);
  assert.equal(sent.options.body.get("language"), "it");
  const file = sent.options.body.get("audio");
  assert.equal(file.type, "audio/wav");
  assert.equal(file.size, 44 + 160 * 2);
  const bytes = new Uint8Array(await file.arrayBuffer());
  assert.equal(String.fromCharCode(...bytes.slice(0, 4)), "RIFF");
  assert.equal(sent.options.redirect, "error");
  assert.equal(sent.options.body.has("video"), false);
});

test("media requires the recorder header and does not invent continuity", () => {
  const first = { id: "a", index: 0, stored: true, bytes: 4, format: "video/webm" };
  const third = { id: "c", index: 2, stored: true, bytes: 4, format: "video/webm" };
  assert.throws(() => contiguousMedia([third]), /header/);
  assert.deepEqual(contiguousMedia([third, first]).chunks.map((chunk) => chunk.id), ["a"]);
  assert.equal(contiguousMedia([third, first]).partial, true);
});

test("timestamps are relative to the current window and invalid coverage is rejected", () => {
  assert.deepEqual(normalizeSegments({ segments: [{ start: 0.2, end: 0.8, text: " ciao " }] }, 5000, 1000), [{ startMs: 5200, endMs: 5800, text: "ciao", timed: true }]);
  assert.throws(() => normalizeSegments({ segments: [{ start: 0, end: 30, text: "ciao" }] }, 5000, 1000), /fuori/);
  assert.equal(wavPcm16(new Float32Array(0)).size, 44);
  assert.equal(BROWSER_TIERS.massima.gated, true);
});

test("browser model timings cannot escape the audio window; untimed text stays untimed", () => {
  assert.deepEqual(normalizeBrowserResult({ chunks: [{ timestamp: [0.1, 0.6], text: " ciao " }] }, 5000, 1000), [{ startMs: 5100, endMs: 5600, text: "ciao", timed: true }]);
  assert.throws(() => normalizeBrowserResult({ chunks: [{ timestamp: [0.1, 1.5], text: "ciao" }] }, 5000, 1000), /fuori/);
  assert.deepEqual(normalizeBrowserResult({ text: "ciao" }, 5000, 1000), [{ startMs: null, endMs: null, text: "ciao", timed: false }]);
});
