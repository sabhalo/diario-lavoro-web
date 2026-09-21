import test from "node:test";
import assert from "node:assert/strict";
import { closeRecording, exportableChunks, formatTime, gapFor, nextRecording, safeFileName, searchDocuments, transcriptText } from "../src/core.js";

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
