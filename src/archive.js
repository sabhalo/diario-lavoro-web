import { mediaExtension } from "./core.js";

const LEGACY_STORES = ["sessions", "recordings", "chunks", "notes", "events", "gaps"];
const STORES = [...LEGACY_STORES, "transcriptRuns", "transcriptSegments"];
const emptySnapshot = () => ({ schemaVersion: 2, sessions: [], recordings: [], chunks: [], notes: [], events: [], gaps: [], transcriptRuns: [], transcriptSegments: [] });
const json = (value) => JSON.parse(JSON.stringify(value));
const text = async (handle) => (await handle.getFile()).text();

export class ArchivePermissionError extends Error { constructor(message = "Permesso lettura/scrittura della cartella non disponibile") { super(message); this.name = "ArchivePermissionError"; } }
export class ArchiveIntegrityError extends Error { constructor(message) { super(message); this.name = "ArchiveIntegrityError"; } }

async function writeFile(directory, name, data, options) {
  const handle = await directory.getFileHandle(name, { create: true });
  const writable = await handle.createWritable(options);
  await writable.write(data);
  await writable.close();
  return handle.getFile();
}

async function directoryAt(root, names) { let directory = root; for (const name of names) directory = await directory.getDirectoryHandle(name, { create: true }); return directory; }
async function readJson(directory, name) { try { return JSON.parse(await text(await directory.getFileHandle(name))); } catch { return null; } }
async function permission(directory, request = false) {
  if (!directory?.queryPermission) return true;
  let value = await directory.queryPermission({ mode: "readwrite" });
  if (value !== "granted" && request && directory.requestPermission) value = await directory.requestPermission({ mode: "readwrite" });
  return value === "granted";
}
function apply(snapshot, entry) {
  if (entry.op === "put") { const list = snapshot[entry.store]; const at = list.findIndex((item) => item.id === entry.value.id); if (at >= 0) list[at] = entry.value; else list.push(entry.value); }
  if (entry.op === "delete-session") { const sessionId = entry.sessionId; snapshot.sessions = snapshot.sessions.filter((item) => item.id !== sessionId); const recordingIds = new Set(snapshot.recordings.filter((item) => item.sessionId === sessionId).map((item) => item.id)); snapshot.recordings = snapshot.recordings.filter((item) => item.sessionId !== sessionId); snapshot.chunks = snapshot.chunks.filter((item) => !recordingIds.has(item.recordingId)); for (const store of ["notes", "events", "gaps", "transcriptRuns", "transcriptSegments"]) snapshot[store] = snapshot[store].filter((item) => item.sessionId !== sessionId); }
  if (entry.op === "delete-run") { snapshot.transcriptRuns = snapshot.transcriptRuns.filter((item) => item.id !== entry.runId); snapshot.transcriptSegments = snapshot.transcriptSegments.filter((item) => item.runId !== entry.runId); }
  return snapshot;
}

export class FileArchive {
  constructor(directory) { this.directory = directory; this.snapshot = emptySnapshot(); }
  static async open(directory, { requestPermission = false } = {}) { if (!await permission(directory, requestPermission)) throw new ArchivePermissionError(); const archive = new FileArchive(directory); await archive.#load(); return archive; }
  async #load() { this.snapshot = await readJson(this.directory, "archive.json") || await readJson(this.directory, "archive.backup.json") || emptySnapshot(); for (const store of STORES) this.snapshot[store] ||= []; const journal = await readJson(this.directory, "journal.json") || []; for (const entry of journal) apply(this.snapshot, entry); if (globalThis.navigator?.locks?.request) await navigator.locks.request("diario-asr-jobs", { ifAvailable: true }, async (lock) => { if (lock) { await this.reconcileTranscriptRuns(); await this.#snapshot(); } }); else { await this.reconcileTranscriptRuns(); await this.#snapshot(); } }
  async #journal(entry) { const prior = await readJson(this.directory, "journal.json") || []; prior.push(entry); await writeFile(this.directory, "journal.json", JSON.stringify(prior)); }
  async #snapshot() { const serialized = JSON.stringify(this.snapshot, null, 2); await writeFile(this.directory, "archive.backup.json", serialized); await writeFile(this.directory, "archive.json", serialized); }
  async #commit(entry) { await this.#journal(entry); apply(this.snapshot, entry); await this.#snapshot(); return entry.value; }
  async all(store) { return json(this.snapshot[store] || []); }
  async get(store, id) { const item = (this.snapshot[store] || []).find((value) => value.id === id); return item ? json(item) : undefined; }
  async bySession(store, sessionId) { return (await this.all(store)).filter((item) => item.sessionId === sessionId); }
  async byRecording(store, recordingId) { return (await this.all(store)).filter((item) => item.recordingId === recordingId); }
  async put(store, value) { if (!STORES.includes(store)) throw new Error(`Store non supportato: ${store}`); if (store === "chunks" && value.blob) return this.writeFragment(value, value.blob); const clean = json(value); delete clean.blob; return this.#commit({ op: "put", store, value: clean }); }
  async writeFragment(chunk, blob) { if (!(blob instanceof Blob) || !blob.size) throw new ArchiveIntegrityError("Frammento media vuoto"); const extension = mediaExtension(chunk.format || blob.type), parts = ["sessions", chunk.sessionId, "media", chunk.recordingId, chunk.stream]; const directory = await directoryAt(this.directory, parts); const name = `${String(chunk.index).padStart(8, "0")}.${extension}`; const file = await writeFile(directory, name, blob); if (file.size !== blob.size) throw new ArchiveIntegrityError("Byte del frammento diversi dopo la chiusura del file"); const clean = { ...json({ ...chunk, status: "salvato", persistedAt: chunk.persistedAt || new Date().toISOString(), bytes: blob.size }), stored: true, path: [...parts, name].join("/") }; delete clean.blob; return this.#commit({ op: "put", store: "chunks", value: clean }); }
  async readFragment(chunk) { if (!chunk?.stored || !chunk.path) throw new ArchiveIntegrityError("Frammento non presente nell'archivio su cartella"); const parts = chunk.path.split("/"); const name = parts.pop(); const directory = await directoryAt(this.directory, parts); const file = await (await directory.getFileHandle(name)).getFile(); if (file.size !== chunk.bytes) throw new ArchiveIntegrityError("Byte del frammento diversi dal manifest"); return file; }
  async deleteTranscriptRun(runId) { if (!this.snapshot.transcriptRuns.some((run) => run.id === runId)) return false; await this.#commit({ op: "delete-run", runId }); return true; }
  async reconcileTranscriptRuns() { for (const run of this.snapshot.transcriptRuns) { if (run.status !== "in elaborazione" && run.status !== "in attesa" && run.status !== "completa") continue; const chunks = this.snapshot.chunks.filter((chunk) => chunk.recordingId === run.recordingId && run.mediaChunkIds?.includes(chunk.id)); let missing = false; for (const chunk of chunks) { try { await this.readFragment(chunk); } catch { missing = true; break; } } if (chunks.length !== (run.mediaChunkIds?.length || 0)) missing = true; if (run.status === "in elaborazione" || run.status === "in attesa" || missing) { run.status = this.snapshot.transcriptSegments.some((segment) => segment.runId === run.id) ? "parziale" : "errore"; run.error = missing ? "Frammenti media mancanti o alterati alla riapertura" : "Elaborazione interrotta alla riapertura"; run.updatedAt = new Date().toISOString(); await this.#journal({ op: "put", store: "transcriptRuns", value: json(run) }); } } }
  async estimate() { return (this.snapshot.chunks || []).reduce((bytes, chunk) => bytes + (chunk.stored ? Number(chunk.bytes) || 0 : 0), 0); }
  async deleteSession(sessionId) { const recordings = await this.bySession("recordings", sessionId), chunks = (await Promise.all(recordings.map((recording) => this.byRecording("chunks", recording.id)))).flat(); try { const sessions = await this.directory.getDirectoryHandle("sessions"); await sessions.removeEntry(sessionId, { recursive: true }); } catch (error) { if (error.name !== "NotFoundError") throw error; } await this.#commit({ op: "delete-session", sessionId }); return { recordings: recordings.length, chunks: chunks.length }; }
  async migrateLegacy(legacy, { onProgress = () => {} } = {}) { const values = {}; for (const store of LEGACY_STORES) values[store] = await legacy.all(store); const total = LEGACY_STORES.reduce((count, store) => count + values[store].length, 0); let completed = 0; onProgress({ phase: "copy", completed, total }); for (const store of LEGACY_STORES) for (const value of values[store]) { if (await this.get(store, value.id)) { completed += 1; onProgress({ phase: "copy", completed, total }); continue; } if (store === "chunks" && value.blob) await this.writeFragment(value, value.blob); else await this.put(store, value); completed += 1; onProgress({ phase: "copy", completed, total }); } onProgress({ phase: "verify", completed, total }); for (const chunk of values.chunks.filter((item) => item.blob)) { const migrated = await this.get("chunks", chunk.id); const file = await this.readFragment(migrated); if (file.size !== chunk.blob.size) throw new ArchiveIntegrityError("Migrazione non verificata"); } await legacy.erase(); onProgress({ phase: "complete", completed: total, total }); return { sessions: values.sessions.length, chunks: values.chunks.length }; }
}

export class MemoryDirectoryAdapter {
  constructor({ permission = "granted" } = {}) { this.permission = permission; this.files = new Map(); this.directories = new Map(); this.failNextWrite = null; }
  async queryPermission() { return this.permission; }
  async requestPermission() { return this.permission; }
  async getDirectoryHandle(name, { create = false } = {}) { if (!this.directories.has(name) && !create) throw new DOMException("Manca", "NotFoundError"); if (!this.directories.has(name)) this.directories.set(name, new MemoryDirectoryAdapter({ permission: this.permission })); return this.directories.get(name); }
  async getFileHandle(name, { create = false } = {}) { if (!this.files.has(name) && !create) throw new DOMException("Manca", "NotFoundError"); if (!this.files.has(name)) this.files.set(name, new Blob()); const directory = this; return { async getFile() { return directory.files.get(name); }, async createWritable() { let next = directory.files.get(name); return { async write(value) { if (directory.failNextWrite) { const error = directory.failNextWrite; directory.failNextWrite = null; throw error; } if (value?.type === "write") { const before = next.slice(0, value.position); const after = next.slice(value.position + (value.data?.size || 0)); next = new Blob([before, value.data, after]); } else next = value instanceof Blob ? value : new Blob([value]); }, async close() { directory.files.set(name, next); } }; } }; }
  async removeEntry(name) { this.files.delete(name); this.directories.delete(name); }
}

const HANDLE_DB = "diario-file-archive-handle";
const handleDb = () => new Promise((resolve, reject) => { const request = indexedDB.open(HANDLE_DB, 1); request.onupgradeneeded = () => request.result.createObjectStore("handles"); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
export async function rememberedDirectory() { const db = await handleDb(); return new Promise((resolve, reject) => { const request = db.transaction("handles").objectStore("handles").get("root"); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); }); }
export async function rememberDirectory(directory) { const db = await handleDb(); await new Promise((resolve, reject) => { const tx = db.transaction("handles", "readwrite"); tx.objectStore("handles").put(directory, "root"); tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); }); }
export async function legacyArchiveExists(name = "diario-di-lavoro") { const databases = await indexedDB.databases?.(); return Array.isArray(databases) && databases.some((database) => database.name === name); }
