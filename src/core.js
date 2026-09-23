export const DB_NAME = "diario-di-lavoro";
export const DB_VERSION = 2;
export const CHUNK_MS = 30_000;

export const id = (prefix) => `${prefix}_${crypto.randomUUID()}`;
export const isoNow = () => new Date().toISOString();

export function sessionOffset(startedAt, at = Date.now()) {
  return Math.max(0, at - new Date(startedAt).getTime());
}

export function interval(startMs, endMs) {
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) {
    throw new Error("Intervallo non valido");
  }
  return { startMs, endMs };
}

export function nextRecording(session, mode) {
  if (!session?.id || !session.startedAt) throw new Error("Sessione non valida");
  const now = isoNow();
  return {
    id: id("rec"), sessionId: session.id, startedAt: now, endedAt: null,
    offsetStartMs: sessionOffset(session.startedAt), offsetEndMs: null,
    status: "in-corso", mode, cause: null, streamStatus: { display: "live", systemAudio: "live", microphone: "live" },
    createdAt: now, updatedAt: now,
  };
}

export function closeRecording(recording, session, status, cause, at = Date.now()) {
  const endedAt = new Date(at).toISOString();
  return {
    ...recording, endedAt, status, cause: cause ?? null,
    offsetEndMs: sessionOffset(session.startedAt, at), updatedAt: endedAt,
  };
}

export function gapFor(recording, session, cause, at = Date.now()) {
  const point = sessionOffset(session.startedAt, at);
  return {
    id: id("gap"), sessionId: session.id, recordingId: recording?.id ?? null,
    ...interval(recording?.offsetEndMs ?? point, point), cause, certainty: "misurata",
    createdAt: isoNow(),
  };
}

export function gapAfterSaved(recording, chunks, cause, certainty = "misurata") {
  const endMs = recording?.offsetEndMs;
  const startMs = exportableChunks(chunks).reduce((latest, chunk) => Math.max(latest, chunk.endMs), recording?.offsetStartMs ?? 0);
  if (!Number.isFinite(endMs) || endMs <= startMs) return null;
  return { recordingId: recording.id, sessionId: recording.sessionId, startMs, endMs, cause, certainty };
}

export function storageAdmission({ usage = 0, quota = 0 } = {}, nextBytes = 0, threshold = .95) {
  if (!Number.isFinite(quota) || quota <= 0) return { allowed: true, known: false, usage: 0, quota: 0, threshold };
  const projected = Math.max(0, usage) + Math.max(0, nextBytes);
  return { allowed: projected <= quota * threshold, known: true, usage: Math.max(0, usage), quota, projected, threshold };
}

export function safeFileName(value) {
  return (value || "sessione").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 70) || "sessione";
}

export function exportableChunks(chunks) {
  return chunks.filter(hasStoredBlob).sort(compareChunks);
}

export function hasStoredBlob(chunk) {
  return Number.isFinite(chunk?.blob?.size) && chunk.blob.size > 0;
}

function compareChunks(a, b) {
  const byStart = (a.startMs ?? 0) - (b.startMs ?? 0);
  return byStart || (a.index ?? 0) - (b.index ?? 0) || String(a.id).localeCompare(String(b.id));
}

export function exportMediaGroups(chunks) {
  const byRecorderAndStream = new Map();
  for (const chunk of exportableChunks(chunks)) {
    const key = `${chunk.recordingId}\u0000${chunk.stream}`;
    const group = byRecorderAndStream.get(key) || [];
    group.push(chunk);
    byRecorderAndStream.set(key, group);
  }
  return [...byRecorderAndStream.values()].map((allChunks) => {
    const ordered = [...allChunks].sort((a, b) => (a.index ?? 0) - (b.index ?? 0) || compareChunks(a, b));
    const first = ordered[0];
    const startsWithHeader = Number.isInteger(first?.index) && first.index === 0;
    const chunksForFile = [];
    let expectedIndex = 0;
    if (startsWithHeader) {
      for (const chunk of ordered) {
        const sameFormat = chunk.format === first.format;
        if (!sameFormat || !Number.isInteger(chunk.index) || chunk.index !== expectedIndex) break;
        chunksForFile.push(chunk);
        expectedIndex += 1;
      }
    }
    const skippedChunks = ordered.slice(chunksForFile.length);
    const blob = chunksForFile.length ? new Blob(chunksForFile.map((chunk) => chunk.blob), { type: first.format || "application/octet-stream" }) : null;
    return {
      recordingId: first.recordingId, stream: first.stream, format: first.format, file: mediaFileName({ ...first, index: null }),
      chunks: chunksForFile, skippedChunks, allChunks: ordered, blob,
      startsWithHeader, continuous: skippedChunks.length === 0,
    };
  }).sort((a, b) => String(a.recordingId).localeCompare(String(b.recordingId)) || String(a.stream).localeCompare(String(b.stream)));
}

export function captureIsLive({ displaySurface, displayTracks = [], microphoneTracks = [], systemTest, microphoneTest }) {
  return displaySurface === "monitor" && displayTracks.length > 1 && microphoneTracks.length > 0 && displayTracks.every((track) => track === "live") && microphoneTracks.every((track) => track === "live") && systemTest?.passed === true && microphoneTest?.passed === true;
}

export function formatTime(ms = 0) {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(seconds / 3600)).padStart(2, "0")}:${String(Math.floor(seconds % 3600 / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

export function searchDocuments(query, { sessions = [], notes = [], events = [] }) {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return [];
  const hits = [];
  for (const session of sessions) {
    if ((session.title || "").toLocaleLowerCase().includes(needle)) hits.push({ sessionId: session.id, documentId: session.id, kind: "titolo", text: session.title, textStatus: "corrente" });
  }
  for (const doc of [...notes, ...events]) {
    if ((doc.text || "").toLocaleLowerCase().includes(needle)) {
      hits.push({ sessionId: doc.sessionId, documentId: doc.id, recordingId: doc.recordingId, offsetMs: doc.startMs, kind: doc.kind || "nota", text: doc.text, textStatus: "corrente" });
    }
  }
  return hits;
}

export function mediaExtension(mime = "") {
  const normalized = mime.split(";", 1)[0].trim().toLocaleLowerCase();
  return ({ "video/webm": "webm", "audio/webm": "webm", "video/mp4": "mp4", "audio/mp4": "m4a", "audio/ogg": "ogg", "video/ogg": "ogv", "audio/wav": "wav" })[normalized] || "bin";
}

export function mediaFileName(chunk) {
  const index = Number.isInteger(chunk.index) ? `-${chunk.index}` : "";
  return `media/${chunk.recordingId.slice(-8)}-${chunk.stream}${index}.${mediaExtension(chunk.format)}`;
}

export function overlapsScope(item, startMs = -Infinity, endMs = Infinity) {
  const itemStart = Number.isFinite(item.startMs) ? item.startMs : item.offsetStartMs;
  const itemEnd = Number.isFinite(item.endMs) ? item.endMs : item.offsetEndMs;
  if (!Number.isFinite(itemStart)) return false;
  return (Number.isFinite(itemEnd) ? itemEnd > startMs : itemStart >= startMs) && itemStart < endMs;
}

export function recordingExportScope(recording, currentOffsetMs) {
  if (!recording || !Number.isFinite(recording.offsetStartMs)) throw new Error("Tratto non valido per export");
  const closed = Number.isFinite(recording.offsetEndMs);
  return { startMs: recording.offsetStartMs, endMs: closed ? recording.offsetEndMs : Math.max(recording.offsetStartMs, currentOffsetMs), endDerivedAtExport: !closed };
}

export function continuousBlockInterval({ recordingStartMs, previousEndMs, timecodeMs, observedAtMs }) {
  const startMs = Number.isFinite(previousEndMs) ? previousEndMs : recordingStartMs;
  const observedEndMs = Number.isFinite(timecodeMs) ? recordingStartMs + Math.max(0, timecodeMs) : observedAtMs;
  return { startMs, endMs: Math.max(startMs, observedEndMs) };
}

export class DiaryStore {
  constructor() { this.db = null; }
  async open() {
    this.db = await new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        for (const name of ["sessions", "recordings", "chunks", "notes", "events", "gaps", "settings"]) {
          if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: "id" });
        }
        if (db.objectStoreNames.contains("transcripts")) db.deleteObjectStore("transcripts");
        for (const [name, field] of [["recordings", "sessionId"], ["chunks", "recordingId"], ["notes", "sessionId"], ["events", "sessionId"], ["gaps", "sessionId"]]) {
          const store = request.transaction.objectStore(name);
          if (!store.indexNames.contains(`${field}Index`)) store.createIndex(`${field}Index`, field, { unique: false });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return this;
  }
  transaction(names, mode = "readonly") { return this.db.transaction(names, mode); }
  async put(store, value) { await new Promise((resolve, reject) => { const tx = this.transaction([store], "readwrite"); tx.objectStore(store).put(value); tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error || new DOMException("Transazione annullata", "AbortError")); }); return value; }
  async get(store, key) { return new Promise((resolve, reject) => { const r = this.transaction([store]).objectStore(store).get(key); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); }); }
  async all(store) { return new Promise((resolve, reject) => { const r = this.transaction([store]).objectStore(store).getAll(); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); }); }
  async bySession(store, sessionId) { return new Promise((resolve, reject) => { const r = this.transaction([store]).objectStore(store).index("sessionIdIndex").getAll(sessionId); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); }); }
  async delete(store, key) { return new Promise((resolve, reject) => { const tx = this.transaction([store], "readwrite"); tx.objectStore(store).delete(key); tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error || new DOMException("Transazione annullata", "AbortError")); }); }
  async deleteSession(sessionId) {
    const recordings = await this.bySession("recordings", sessionId);
    const chunks = (await Promise.all(recordings.map((r) => this.byRecording("chunks", r.id)))).flat();
    const related = {};
    for (const store of ["notes", "events", "gaps"]) related[store] = await this.bySession(store, sessionId);
    const tx = this.transaction(["sessions", "recordings", "chunks", "notes", "events", "gaps"], "readwrite");
    tx.objectStore("sessions").delete(sessionId);
    for (const store of ["recordings", "notes", "events", "gaps"]) {
      const items = store === "recordings" ? recordings : related[store];
      for (const item of items) tx.objectStore(store).delete(item.id);
    }
    for (const chunk of chunks) tx.objectStore("chunks").delete(chunk.id);
    await new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error || new DOMException("Rimozione annullata", "AbortError")); });
    return { recordings: recordings.length, chunks: chunks.length };
  }
  async byRecording(store, recordingId) { return new Promise((resolve, reject) => { const tx = this.transaction([store]); const index = tx.objectStore(store).index("recordingIdIndex"); const r = index.getAll(recordingId); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); }); }
}
