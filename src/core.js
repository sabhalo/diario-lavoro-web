export const DB_NAME = "diario-di-lavoro";
export const DB_VERSION = 1;
export const CHUNK_MS = 10_000;

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

export function gapAfterConfirmed(recording, chunks, cause, certainty = "misurata") {
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

export function transcriptText(segments) {
  return [...segments].sort((a, b) => a.startMs - b.startMs)
    .map((s) => {
      const provenance = [s.source, s.engine, s.version ? `v${s.version}` : null].filter(Boolean).join("; ");
      return `[${formatTime(s.startMs)}]${provenance ? ` [${provenance}]` : ""} ${s.text}`;
    }).join("\n");
}

export function exportableChunks(chunks) {
  return chunks.filter((chunk) => chunk.status === "confermato").sort((a, b) => a.startMs - b.startMs);
}

export function supersededAsrSegments(segments, source) {
  return segments.filter((segment) => segment.source === "asr-locale" && segment.asrSource === source && segment.active !== false);
}

export function supersededAsrSegmentsForBlocks(segments, source, blockIds) {
  return supersededAsrSegments(segments, source).filter((segment) => blockIds.has(segment.blockId));
}

export function captureIsLive({ displaySurface, displayTracks = [], microphoneTracks = [], systemTest, microphoneTest }) {
  return displaySurface === "monitor" && displayTracks.length > 1 && microphoneTracks.length > 0 && displayTracks.every((track) => track === "live") && microphoneTracks.every((track) => track === "live") && systemTest?.passed === true && microphoneTest?.passed === true;
}

export function canTranscribe({ pipelineReady, preparedModel, selectedModel }) { return pipelineReady === true && !!preparedModel && preparedModel === selectedModel; }

export function formatTime(ms = 0) {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(seconds / 3600)).padStart(2, "0")}:${String(Math.floor(seconds % 3600 / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

export function searchDocuments(query, { sessions = [], notes = [], events = [], transcripts = [] }, { includeOriginal = false } = {}) {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return [];
  const hits = [];
  for (const session of sessions) {
    if ((session.title || "").toLocaleLowerCase().includes(needle)) hits.push({ sessionId: session.id, documentId: session.id, kind: "titolo", text: session.title, textStatus: "corrente" });
  }
  const visibleTranscripts = includeOriginal ? transcripts : transcripts.filter((item) => item.active !== false);
  for (const doc of [...notes, ...events, ...visibleTranscripts]) {
    if ((doc.text || "").toLocaleLowerCase().includes(needle)) {
      const transcript = !!doc.source;
      hits.push({ sessionId: doc.sessionId, documentId: doc.id, recordingId: doc.recordingId, offsetMs: doc.startMs, kind: doc.kind || (transcript ? "trascrizione" : "nota"), text: doc.text, textStatus: transcript ? (doc.active === false ? "originale/versione conservata" : "versione attiva") : "corrente", provenance: transcript ? { source: doc.source, engine: doc.engine, version: doc.version } : null });
    }
  }
  return hits;
}

export function mediaExtension(mime = "") {
  const normalized = mime.split(";", 1)[0].trim().toLocaleLowerCase();
  return ({ "video/webm": "webm", "audio/webm": "webm", "video/mp4": "mp4", "audio/mp4": "m4a", "audio/ogg": "ogg", "video/ogg": "ogv", "audio/wav": "wav" })[normalized] || "bin";
}

export function mediaFileName(chunk) {
  return `media/${chunk.recordingId.slice(-8)}-${chunk.stream}-${chunk.index}.${mediaExtension(chunk.format)}`;
}

export function overlapsScope(item, startMs = -Infinity, endMs = Infinity) {
  const itemStart = Number.isFinite(item.startMs) ? item.startMs : item.offsetStartMs;
  const itemEnd = Number.isFinite(item.endMs) ? item.endMs : item.offsetEndMs;
  if (!Number.isFinite(itemStart)) return false;
  return (Number.isFinite(itemEnd) ? itemEnd > startMs : itemStart >= startMs) && itemStart < endMs;
}

export function exportTranscript(segment, chunksById) {
  const sourceChunk = segment.blockId ? chunksById.get(segment.blockId) : null;
  return { ...segment, sourceMediaStatus: sourceChunk ? sourceChunk.status === "confermato" ? "verificabile" : "sorgente non verificabile" : segment.blockId ? "sorgente non trovata" : "nessun blocco sorgente dichiarato" };
}

export class DiaryStore {
  constructor() { this.db = null; }
  async open() {
    this.db = await new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        for (const name of ["sessions", "recordings", "chunks", "notes", "events", "gaps", "transcripts", "settings"]) {
          if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: "id" });
        }
        for (const [name, field] of [["recordings", "sessionId"], ["chunks", "recordingId"], ["notes", "sessionId"], ["events", "sessionId"], ["gaps", "sessionId"], ["transcripts", "sessionId"]]) {
          const store = request.transaction.objectStore(name);
          store.createIndex(`${field}Index`, field, { unique: false });
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
    for (const store of ["notes", "events", "gaps", "transcripts"]) related[store] = await this.bySession(store, sessionId);
    const tx = this.transaction(["sessions", "recordings", "chunks", "notes", "events", "gaps", "transcripts"], "readwrite");
    tx.objectStore("sessions").delete(sessionId);
    for (const store of ["recordings", "notes", "events", "gaps", "transcripts"]) {
      const items = store === "recordings" ? recordings : related[store];
      for (const item of items) tx.objectStore(store).delete(item.id);
    }
    for (const chunk of chunks) tx.objectStore("chunks").delete(chunk.id);
    await new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error || new DOMException("Rimozione annullata", "AbortError")); });
    return { recordings: recordings.length, chunks: chunks.length };
  }
  async byRecording(store, recordingId) { return new Promise((resolve, reject) => { const tx = this.transaction([store]); const index = tx.objectStore(store).index("recordingIdIndex"); const r = index.getAll(recordingId); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); }); }
}
