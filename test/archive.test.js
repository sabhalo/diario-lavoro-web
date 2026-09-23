import test from "node:test";
import assert from "node:assert/strict";
import { ArchivePermissionError, FileArchive, MemoryDirectoryAdapter } from "../src/archive.js";

const session = { id: "s1", title: "Prova", state: "aperta" };
const chunk = { id: "c1", sessionId: "s1", recordingId: "r1", stream: "microfono", index: 0, startMs: 0, endMs: 30_000, format: "audio/webm", status: "non verificabile", bytes: 6, blob: new Blob(["audio!"]) };

test("archive blocks access after a directory permission is revoked", async () => {
  const directory = new MemoryDirectoryAdapter();
  await FileArchive.open(directory);
  directory.permission = "denied";
  await assert.rejects(FileArchive.open(directory), ArchivePermissionError);
});

test("archive writes a fragment, closes it, and reopens it from the chosen directory", async () => {
  const directory = new MemoryDirectoryAdapter(), archive = await FileArchive.open(directory);
  await archive.put("sessions", session);
  await archive.writeFragment(chunk, chunk.blob);
  const reopened = await FileArchive.open(directory), stored = await reopened.get("chunks", "c1");
  assert.equal(stored.status, "salvato");
  assert.equal(stored.stored, true);
  assert.equal(await (await reopened.readFragment(stored)).text(), "audio!");
  assert.equal(await reopened.estimate(), 6);
});

test("journal recovers metadata after a snapshot is missing at reopening", async () => {
  const directory = new MemoryDirectoryAdapter(), archive = await FileArchive.open(directory);
  await archive.put("sessions", session);
  directory.files.delete("archive.json");
  const reopened = await FileArchive.open(directory);
  assert.deepEqual(await reopened.all("sessions"), [session]);
});

test("legacy migration is idempotent and erases browser data only after verified files", async () => {
  const directory = new MemoryDirectoryAdapter(), archive = await FileArchive.open(directory);
  let erased = false;
  const legacy = { all: async (store) => ({ sessions: [session], recordings: [{ id: "r1", sessionId: "s1" }], chunks: [chunk], notes: [], events: [], gaps: [] })[store], erase: async () => { erased = true; } };
  const first = await archive.migrateLegacy(legacy);
  const second = await archive.migrateLegacy(legacy);
  assert.deepEqual(first, { sessions: 1, chunks: 1 });
  assert.deepEqual(second, { sessions: 1, chunks: 1 });
  assert.equal(erased, true);
  assert.equal(await (await archive.readFragment(await archive.get("chunks", "c1"))).text(), "audio!");
});

test("legacy migration reports copy, verification, and completion progress", async () => {
  const directory = new MemoryDirectoryAdapter(), archive = await FileArchive.open(directory), progress = [];
  const legacy = { all: async (store) => ({ sessions: [session], recordings: [], chunks: [chunk], notes: [], events: [], gaps: [] })[store], erase: async () => {} };
  await archive.migrateLegacy(legacy, { onProgress: (update) => progress.push(update) });
  assert.deepEqual(progress[0], { phase: "copy", completed: 0, total: 2 });
  assert.ok(progress.some((update) => update.phase === "verify"));
  assert.deepEqual(progress.at(-1), { phase: "complete", completed: 2, total: 2 });
});

test("failed fragment write does not create saved chunk metadata", async () => {
  const directory = new MemoryDirectoryAdapter(), archive = await FileArchive.open(directory), media = await directory.getDirectoryHandle("sessions", { create: true });
  const sessionDirectory = await media.getDirectoryHandle("s1", { create: true }), mediaDirectory = await sessionDirectory.getDirectoryHandle("media", { create: true }), recordingDirectory = await mediaDirectory.getDirectoryHandle("r1", { create: true }), streamDirectory = await recordingDirectory.getDirectoryHandle("microfono", { create: true });
  streamDirectory.failNextWrite = new DOMException("Quota", "QuotaExceededError");
  await assert.rejects(archive.writeFragment(chunk, chunk.blob), /Quota/);
  assert.equal(await archive.get("chunks", "c1"), undefined);
});
