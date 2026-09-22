import test from "node:test";
import assert from "node:assert/strict";
import { canTranscribe, captureIsLive, closeRecording, exportableChunks, formatTime, gapAfterConfirmed, gapFor, nextRecording, safeFileName, searchDocuments, storageAdmission, supersededAsrSegments, supersededAsrSegmentsForBlocks, transcriptText } from "../src/core.js";
import { createZip, needsZip64, streamZip } from "../src/zip.js";
import { ASR_PROFILES, asrChunks, asrProfile, asrResultShape, audioMetrics, usesWholeBlockTimestamp } from "../src/asr-core.js";

const session = { id: "s1", startedAt: "2026-09-22T10:00:00.000Z" };
test("recording keeps session timeline offsets", () => {
  const recording = nextRecording(session, "completa");
  const closed = closeRecording(recording, session, "terminata", "pausa", Date.parse(session.startedAt) + 5_000);
  assert.equal(closed.offsetEndMs, 5_000);
  assert.equal(closed.status, "terminata");
});
test("gap is explicit and never negative", () => {
  const recording = { id: "r1", offsetEndMs: 900 };
  assert.deepEqual(gapFor(recording, session, "sleep", Date.parse(session.startedAt) + 1_200).startMs, 900);
});
test("interruption gap starts after the last confirmed block and omits zero-length gaps", () => {
  const recording = { id: "r1", sessionId: "s1", offsetStartMs: 100, offsetEndMs: 900 };
  assert.deepEqual(gapAfterConfirmed(recording, [{ status: "confermato", endMs: 700 }], "revoca"), { recordingId: "r1", sessionId: "s1", startMs: 700, endMs: 900, cause: "revoca", certainty: "misurata" });
  assert.equal(gapAfterConfirmed(recording, [{ status: "confermato", endMs: 900 }], "revoca"), null);
});
test("storage admission rejects a capture before recording when projected usage is too high", () => {
  assert.equal(storageAdmission({ usage: 94, quota: 100 }, 0).allowed, true);
  assert.equal(storageAdmission({ usage: 95, quota: 100 }, 1).allowed, false);
  assert.equal(storageAdmission({}, 1).known, false);
});
test("search returns source and temporal jump", () => {
  const hits = searchDocuments("progetto", { sessions: [{ id: "s1", title: "Progetto alfa" }], notes: [{ sessionId: "s1", text: "nota" }], events: [], transcripts: [{ sessionId: "s1", startMs: 3_000, source: "locale", text: "progetto discusso" }] });
  assert.equal(hits.length, 2); assert.equal(hits[1].offsetMs, 3_000);
});
test("export helpers are deterministic", () => {
  assert.equal(formatTime(3_661_000), "01:01:01");
  assert.equal(safeFileName("Caffè / prova"), "Caffe-prova");
  assert.match(transcriptText([{ startMs: 10, text: "ciao" }]), /00:00:00/);
});
test("media export excludes blocks that were not confirmed", () => {
  assert.deepEqual(exportableChunks([{ id: "a", status: "scritto", startMs: 0 }, { id: "b", status: "confermato", startMs: 20 }, { id: "c", status: "non verificabile", startMs: 10 }]).map((item) => item.id), ["b"]);
});
test("a recovery checkpoint never exports written or unplayable media", () => {
  const afterRecovery = [{ id: "written-now-bad", status: "non verificabile", startMs: 1 }, { id: "good", status: "confermato", startMs: 2 }];
  assert.deepEqual(exportableChunks(afterRecovery).map((item) => item.id), ["good"]);
});
test("reprocessing one ASR source preserves the other source", () => {
  const old = [{ id: "mic", source: "asr-locale", asrSource: "microfono", active: true }, { id: "display", source: "asr-locale", asrSource: "display", active: true }];
  assert.deepEqual(supersededAsrSegments(old, "microfono").map((item) => item.id), ["mic"]);
});
test("failed reprocessing preserves prior ASR outside successful blocks", () => {
  const old = [{ id: "old-a", source: "asr-locale", asrSource: "microfono", blockId: "a", active: true }, { id: "old-b", source: "asr-locale", asrSource: "microfono", blockId: "b", active: true }];
  assert.deepEqual(supersededAsrSegmentsForBlocks(old, "microfono", new Set(["a"])).map((item) => item.id), ["old-a"]);
});
test("ZIP fallback has a valid central directory with manifest, transcript, and media", async () => {
  const bytes = new Uint8Array(await (await createZip([{ name: "manifest.json", data: "{}" }, { name: "trascrizione.txt", data: "ciao" }, { name: "media/mic-0.webm", data: Uint8Array.of(1, 2) }])).arrayBuffer());
  const view = new DataView(bytes.buffer), names = []; for (let offset = 0; offset < bytes.length - 46; offset += 1) if (view.getUint32(offset, true) === 0x02014b50) { const length = view.getUint16(offset + 28, true); names.push(new TextDecoder().decode(bytes.slice(offset + 46, offset + 46 + length))); }
  assert.deepEqual(names, ["manifest.json", "trascrizione.txt", "media/mic-0.webm"]); assert.equal(view.getUint32(bytes.length - 22, true), 0x06054b50);
});
test("streaming ZIP writes one extractable archive layout", async () => {
  const writes = [], writable = { write: async (chunk) => writes.push(new Uint8Array(chunk)), close: async () => {} };
  await streamZip([{ name: "manifest.json", data: "{}" }, { name: "media/display-0.webm", data: new Blob([Uint8Array.of(3, 4)]) }], writable);
  const size = writes.reduce((sum, chunk) => sum + chunk.length, 0), bytes = new Uint8Array(size); let offset = 0; for (const chunk of writes) { bytes.set(chunk, offset); offset += chunk.length; }
  const view = new DataView(bytes.buffer); assert.equal(view.getUint32(bytes.length - 22, true), 0x06054b50); assert.match(new TextDecoder().decode(bytes), /media\/display-0\.webm/); assert.ok([...bytes].some((_, index) => index < bytes.length - 4 && view.getUint32(index, true) === 0x06064b50));
});
test("ZIP64 boundary is selected without allocating a multi-gigabyte archive", () => {
  assert.equal(needsZip64({ size: 0xffffffffn }), false); assert.equal(needsZip64({ size: 0x1_0000_0000n }), true); assert.equal(needsZip64({ entries: 0xffff }), true);
});
test("preflight rejects tracks that ended before capture starts", () => {
  const base = { displaySurface: "monitor", displayTracks: ["live", "live"], microphoneTracks: ["live"], systemTest: { passed: true }, microphoneTest: { passed: true } };
  assert.equal(captureIsLive(base), true); assert.equal(captureIsLive({ ...base, microphoneTracks: ["ended"] }), false);
});
test("ASR diagnostics preserve a measurable 16 kHz signal and clamp open timestamps", () => {
  const metrics = audioMetrics(Float32Array.from([0, .1, -.1, 0]), 16_000); assert.equal(metrics.samples, 4); assert.ok(Math.abs(metrics.peak - .1) < .00001); assert.ok(metrics.rms > .07);
  assert.deepEqual(asrChunks({ chunks: [{ text: "ciao", timestamp: [0.2, null] }] }, { startMs: 1_000, endMs: 2_000 }), [{ startMs: 1_200, endMs: 2_000, text: "ciao" }]);
});
test("ASR keeps root text when WebGPU returns only blank timestamp chunks", () => {
  const result = { text: " frase riconosciuta ", chunks: [{ text: "", timestamp: [0, 1] }] }, block = { startMs: 1_000, endMs: 2_000 };
  assert.deepEqual(asrResultShape(result), { resultType: "object", keys: ["chunks", "text"], textChars: 18, chunks: 1, nonEmptyChunks: 0, timestampedChunks: 1 });
  assert.equal(usesWholeBlockTimestamp(result), true);
  assert.deepEqual(asrChunks(result, block), [{ startMs: 1_000, endMs: 2_000, text: "frase riconosciuta" }]);
});
test("high quality is an explicit Small q8 profile", () => {
  assert.equal(asrProfile("precision"), ASR_PROFILES.precision);
  assert.equal(asrProfile("Xenova/whisper-small"), ASR_PROFILES.precision);
  assert.equal(ASR_PROFILES.rapid.device, "wasm");
  assert.equal(ASR_PROFILES.precision.device, "wasm");
  assert.equal(ASR_PROFILES.precision.dtype, "q8");
});
test("transcription cannot implicitly download an unprepared model", () => {
  assert.equal(canTranscribe({ pipelineReady: false, preparedModel: "Xenova/whisper-tiny", selectedModel: "Xenova/whisper-tiny" }), false);
  assert.equal(canTranscribe({ pipelineReady: true, preparedModel: "Xenova/whisper-tiny", selectedModel: "Xenova/whisper-base" }), false);
  assert.equal(canTranscribe({ pipelineReady: true, preparedModel: "Xenova/whisper-tiny", selectedModel: "Xenova/whisper-tiny" }), true);
});
