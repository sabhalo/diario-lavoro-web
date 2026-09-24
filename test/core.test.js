import test from "node:test";
import assert from "node:assert/strict";
import { captureIsLive, closeRecording, continuousBlockInterval, exportableChunks, exportMediaGroups, formatTime, gapAfterSaved, gapFor, mediaFileName, nextRecording, overlapsScope, recordingExportScope, safeFileName, searchDocuments, storageAdmission } from "../src/core.js";
import { createZip, needsZip64, streamZip } from "../src/zip.js";

const session = { id: "s1", startedAt: "2026-09-22T10:00:00.000Z" };
test("recording keeps session timeline offsets", () => {
  const recording = nextRecording(session, "completa");
  const closed = closeRecording(recording, session, "terminata", "pausa", Date.parse(session.startedAt) + 5_000);
  assert.equal(closed.offsetEndMs, 5_000);
  assert.equal(closed.status, "terminata");
});
test("gap is explicit and never negative", () => {
  const recording = { id: "r1", offsetEndMs: 900 };
  assert.equal(gapFor(recording, session, "sleep", Date.parse(session.startedAt) + 1_200).startMs, 900);
});
test("interruption gap starts after the last saved block", () => {
  const recording = { id: "r1", sessionId: "s1", offsetStartMs: 100, offsetEndMs: 900 };
  assert.deepEqual(gapAfterSaved(recording, [{ status: "non verificabile", endMs: 700, blob: new Blob(["saved"]) }], "revoca"), { recordingId: "r1", sessionId: "s1", startMs: 700, endMs: 900, cause: "revoca", certainty: "misurata" });
});
test("storage admission rejects projected quota exhaustion", () => {
  assert.equal(storageAdmission({ usage: 95, quota: 100 }, 1).allowed, false);
  assert.equal(storageAdmission({}, 1).known, false);
});
test("search indexes text actually present in titles, notes, and events", () => {
  const hits = searchDocuments("progetto", { sessions: [{ id: "s1", title: "Progetto alfa" }], notes: [{ id: "n1", sessionId: "s1", startMs: 3_000, text: "progetto discusso" }], events: [] });
  assert.equal(hits.length, 2);
  assert.equal(hits[1].offsetMs, 3_000);
  assert.equal(hits[1].kind, "nota");
});
test("search distinguishes transcript source, version, and missing timestamps", () => {
  const transcriptRuns = [{ id: "run1", version: 2, status: "parziale", active: true }];
  const transcriptSegments = [{ id: "seg1", runId: "run1", sessionId: "s1", recordingId: "r1", source: "audio del computer", text: "progetto discusso", timed: false, startMs: null }];
  const hits = searchDocuments("progetto", { transcriptRuns, transcriptSegments });
  assert.equal(hits.length, 1);
  assert.equal(hits[0].source, "audio del computer");
  assert.equal(hits[0].offsetMs, null);
  assert.match(hits[0].textStatus, /versione 2.*parziale.*attiva/);
});
test("continuous recorder intervals use monotonic timecodes without gaps", () => {
  const first = continuousBlockInterval({ recordingStartMs: 1_000, previousEndMs: null, timecodeMs: 30_000, observedAtMs: 31_500 });
  const second = continuousBlockInterval({ recordingStartMs: 1_000, previousEndMs: first.endMs, timecodeMs: 60_000, observedAtMs: 63_000 });
  assert.deepEqual(first, { startMs: 1_000, endMs: 31_000 });
  assert.deepEqual(second, { startMs: 31_000, endMs: 61_000 });
});
test("continuous recorder never moves backwards when callbacks are late", () => {
  const interval = continuousBlockInterval({ recordingStartMs: 1_000, previousEndMs: 31_000, timecodeMs: 29_000, observedAtMs: 60_000 });
  assert.deepEqual(interval, { startMs: 31_000, endMs: 31_000 });
});
test("export helpers preserve media-only scope and MIME extensions", () => {
  assert.equal(formatTime(3_661_000), "01:01:01");
  assert.equal(safeFileName("Caffè / prova"), "Caffe-prova");
  assert.equal(mediaFileName({ recordingId: "recording-12345678", stream: "microfono", index: 2, format: "audio/mp4;codecs=mp4a" }), "media/12345678-microfono-2.m4a");
  assert.equal(overlapsScope({ startMs: 50, endMs: 150 }, 100, 200), true);
  assert.deepEqual(recordingExportScope({ offsetStartMs: 100, offsetEndMs: null }, 250), { startMs: 100, endMs: 250, endDerivedAtExport: true });
});
test("export groups saved fragments even when each fragment is not independently playable", async () => {
  const chunks = [
    { id: "first", recordingId: "r1", stream: "display", index: 0, startMs: 0, endMs: 30_000, format: "video/webm", status: "non verificabile", blob: new Blob(["header-"]) },
    { id: "second", recordingId: "r1", stream: "display", index: 1, startMs: 30_000, endMs: 60_000, format: "video/webm", status: "non verificabile", blob: new Blob(["continuation"]) },
  ];
  assert.deepEqual(exportableChunks(chunks).map((item) => item.id), ["first", "second"]);
  const groups = exportMediaGroups(chunks);
  assert.equal(groups.length, 1);
  assert.deepEqual(groups[0].chunks.map((item) => item.id), ["first", "second"]);
  assert.equal(await groups[0].blob.text(), "header-continuation");
  const archive = new Uint8Array(await (await createZip([{ name: "manifest.json", data: "{}" }, ...groups.filter((group) => group.blob).map((group) => ({ name: group.file, data: group.blob }))])).arrayBuffer());
  assert.match(new TextDecoder().decode(archive), /media\/r1-display\.webm/);
});
test("export does not claim a continuation without the recorder header is reopenable", () => {
  const [group] = exportMediaGroups([{ id: "later", recordingId: "r1", stream: "microfono", index: 1, startMs: 30_000, endMs: 60_000, format: "audio/webm", status: "salvato", blob: new Blob(["continuation"]) }]);
  assert.equal(group.startsWithHeader, false);
  assert.equal(group.blob, null);
  assert.deepEqual(group.skippedChunks.map((chunk) => chunk.id), ["later"]);
});
test("ZIP fallback contains only manifest and media entries", async () => {
  const bytes = new Uint8Array(await (await createZip([{ name: "manifest.json", data: "{}" }, { name: "media/mic-0.webm", data: Uint8Array.of(1, 2) }])).arrayBuffer());
  const view = new DataView(bytes.buffer), names = []; for (let offset = 0; offset < bytes.length - 46; offset += 1) if (view.getUint32(offset, true) === 0x02014b50) { const length = view.getUint16(offset + 28, true); names.push(new TextDecoder().decode(bytes.slice(offset + 46, offset + 46 + length))); }
  assert.deepEqual(names, ["manifest.json", "media/mic-0.webm"]); assert.equal(view.getUint32(bytes.length - 22, true), 0x06054b50);
});
test("streaming ZIP writes an extractable media archive layout", async () => {
  const writes = [], writable = { write: async (chunk) => writes.push(new Uint8Array(chunk)), close: async () => {} };
  await streamZip([{ name: "manifest.json", data: "{}" }, { name: "media/display-0.webm", data: new Blob([Uint8Array.of(3, 4)]) }], writable);
  const size = writes.reduce((sum, chunk) => sum + chunk.length, 0), bytes = new Uint8Array(size); let offset = 0; for (const chunk of writes) { bytes.set(chunk, offset); offset += chunk.length; }
  const view = new DataView(bytes.buffer); assert.equal(view.getUint32(bytes.length - 22, true), 0x06054b50); assert.match(new TextDecoder().decode(bytes), /media\/display-0\.webm/);
});
test("ZIP64 boundary is selected without allocating a multi-gigabyte archive", () => {
  assert.equal(needsZip64({ size: 0xffffffffn }), false); assert.equal(needsZip64({ size: 0x1_0000_0000n }), true);
});
test("preflight rejects tracks that ended before capture starts", () => {
  const base = { displaySurface: "monitor", displayTracks: ["live", "live"], microphoneTracks: ["live"], systemTest: { passed: true }, microphoneTest: { passed: true } };
  assert.equal(captureIsLive(base), true); assert.equal(captureIsLive({ ...base, microphoneTracks: ["ended"] }), false);
});
