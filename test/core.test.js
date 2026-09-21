import test from "node:test";
import assert from "node:assert/strict";
import { closeRecording, exportableChunks, formatTime, gapFor, nextRecording, safeFileName, searchDocuments, supersededAsrSegments, transcriptText } from "../src/core.js";
import { createZip, streamZip } from "../src/zip.js";

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
test("ZIP fallback has a valid central directory with manifest, transcript, and media", async () => {
  const bytes = new Uint8Array(await (await createZip([{ name: "manifest.json", data: "{}" }, { name: "trascrizione.txt", data: "ciao" }, { name: "media/mic-0.webm", data: Uint8Array.of(1, 2) }])).arrayBuffer());
  const view = new DataView(bytes.buffer), names = []; for (let offset = 0; offset < bytes.length - 46; offset += 1) if (view.getUint32(offset, true) === 0x02014b50) { const length = view.getUint16(offset + 28, true); names.push(new TextDecoder().decode(bytes.slice(offset + 46, offset + 46 + length))); }
  assert.deepEqual(names, ["manifest.json", "trascrizione.txt", "media/mic-0.webm"]); assert.equal(view.getUint32(bytes.length - 22, true), 0x06054b50);
});
test("streaming ZIP writes one extractable archive layout", async () => {
  const writes = [], writable = { write: async (chunk) => writes.push(new Uint8Array(chunk)), close: async () => {} };
  await streamZip([{ name: "manifest.json", data: "{}" }, { name: "media/display-0.webm", data: new Blob([Uint8Array.of(3, 4)]) }], writable);
  const size = writes.reduce((sum, chunk) => sum + chunk.length, 0), bytes = new Uint8Array(size); let offset = 0; for (const chunk of writes) { bytes.set(chunk, offset); offset += chunk.length; }
  const view = new DataView(bytes.buffer); assert.equal(view.getUint32(bytes.length - 22, true), 0x06054b50); assert.match(new TextDecoder().decode(bytes), /media\/display-0\.webm/);
});
