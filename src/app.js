import { captureIsLive, CHUNK_MS, continuousBlockInterval, DiaryStore, closeRecording, exportMediaGroups, formatTime, gapAfterSaved, hasStoredBlob, id, isoNow, nextRecording, overlapsScope, recordingExportScope, safeFileName, searchDocuments, sessionOffset } from "./core.js?v=13";
import { FileArchive, legacyArchiveExists, rememberedDirectory, rememberDirectory } from "./archive.js?v=1";
import { createZip, streamZip } from "./zip.js?v=2";
import { audioWindows, BROWSER_TIERS, contiguousMedia, normalizeBrowserResult, normalizeSegments, preflightLocalAsr, transcribeLocal } from "./asr.js?v=1";
import { LARGE_MODEL_ASSETS, LARGE_MODEL_REVISION, prepareLargeModelFiles } from "./model-files.bundle.js?v=1";
const state = { store: null, rememberedDirectory: null, legacyAvailable: false, view: "home", selectedId: null, jumpOffset: null, display: null, mic: null, displayInfo: null, tests: { system: null, mic: null }, meters: new Map(), recording: null, segmenters: [], capturing: false, stopping: false, captureFormat: "video", asr: { path: "browser", tier: "rapido", url: "http://127.0.0.1:8765/asr", loading: null, modelDownload: null, job: null, pipelines: new Map() } };
const view = document.querySelector("#view"), dialog = document.querySelector("#dialog"), storageStatus = document.querySelector("#storage-status");
const esc = (value = "") => String(value).replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char]);
const byId = (id) => document.getElementById(id);
const localDate = (iso) => iso ? new Intl.DateTimeFormat("it-IT", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso)) : "—";
const streamState = (stream) => stream?.getTracks().some((track) => track.readyState === "live") ? "live" : "assente";

async function init() {
  if (!window.isSecureContext) showNotice("Questa app richiede localhost o HTTPS per chiedere le catture.", "danger");
  document.addEventListener("click", onClick); document.addEventListener("submit", onSubmit); document.addEventListener("change", onChange);
  window.addEventListener("pageshow", (event) => { if (event.persisted) window.location.reload(); });
  if (!await claimArchiveTab()) { document.querySelectorAll(".nav, #new-session").forEach((button) => { button.disabled = true; }); view.innerHTML = `<section class="card"><h1>Archivio già aperto</h1><p>Un'altra scheda usa questa app e la cartella archivio. Chiudila e ricarica questa pagina per evitare scritture concorrenti.</p></section>`; return; }
  navigator.serviceWorker?.getRegistrations?.().then((registrations) => Promise.all(registrations.map((registration) => registration.unregister()))).catch(() => {});
  globalThis.caches?.keys?.().then((keys) => Promise.all(keys.filter((key) => key.startsWith("diario-lavoro-")).map((key) => globalThis.caches.delete(key)))).catch(() => {});
  try { state.rememberedDirectory = await rememberedDirectory(); if (state.rememberedDirectory) await connectDirectory(state.rememberedDirectory); else renderDirectoryGate(); }
  catch { renderDirectoryGate("La cartella precedente richiede di nuovo il permesso di lettura/scrittura."); }
}

function claimArchiveTab() {
  if (!navigator.locks?.request) return Promise.resolve(true);
  return new Promise((resolve) => {
    navigator.locks.request("diario-app-owner", { ifAvailable: true }, async (lock) => {
      resolve(!!lock);
      if (lock) await new Promise((release) => window.addEventListener("pagehide", release, { once: true }));
    }).catch(() => resolve(false));
  });
}

async function connectDirectory(directory, requestPermission = false) { state.store = await FileArchive.open(directory, { requestPermission }); state.rememberedDirectory = directory; await rememberDirectory(directory); document.querySelectorAll(".nav").forEach((button) => { button.disabled = false; }); byId("new-session").disabled = false; state.legacyAvailable = await legacyArchiveExists(); await updateStorage(); await recoverInterrupted(); await render(); if (state.legacyAvailable) showNotice("Sono stati trovati dati legacy nel browser. Usa “Migra dati browser” per copiarli verificandoli nella cartella, poi rimuovere la copia legacy.", "warn"); }
function renderDirectoryGate(reason = "Scegli una cartella locale con permesso di lettura e scrittura per iniziare.") { state.store = null; document.querySelectorAll(".nav").forEach((button) => { button.disabled = true; }); byId("new-session").disabled = true; storageStatus.textContent = "Cartella locale richiesta"; view.innerHTML = `<section class="card"><h1>Cartella locale richiesta</h1><p>${esc(reason)}</p><p class="muted">Sessioni, media, note, eventi, lacune e journal vengono salvati come file nella cartella scelta. L'app non usa IndexedDB, OPFS o cache browser per questi dati.</p><div class="actions">${state.rememberedDirectory ? '<button data-action="reconnect-directory">Ricollega la cartella già scelta</button>' : ''}<button class="secondary" data-action="choose-directory">Scegli un’altra cartella</button></div></section>`; }
async function reconnectDirectory() { if (!state.rememberedDirectory) return chooseDirectory(); try { await connectDirectory(state.rememberedDirectory, true); } catch (error) { renderDirectoryGate(`La cartella già scelta non è stata ricollegata: ${error.message}`); } }
async function chooseDirectory() { if (!window.showDirectoryPicker) return showNotice("Questo browser non supporta la scelta di una cartella locale. Usa Chrome aggiornato su macOS o Windows.", "danger"); try { await connectDirectory(await window.showDirectoryPicker({ mode: "readwrite" }), true); } catch (error) { if (error.name === "AbortError") return; renderDirectoryGate(error.message); } }
async function migrateLegacy() { if (!state.store) return renderDirectoryGate(); const button = document.querySelector('[data-action="migrate-legacy"]'); if (button) button.disabled = true; showNotice("Migrazione in corso: preparo la copia dei dati browser nella cartella locale.", "warn"); try { const legacy = await new DiaryStore().open(), result = await state.store.migrateLegacy(legacy, { onProgress: ({ phase, completed, total }) => showNotice(phase === "verify" ? "Migrazione in corso: verifico i file nella cartella locale." : phase === "complete" ? "Migrazione completata: aggiorno la vista." : `Migrazione in corso: ${completed}/${total} elementi copiati nella cartella locale.`, "warn") }); state.legacyAvailable = false; await updateStorage(); await render(); showNotice(`Migrazione verificata: ${result.sessions} sessioni e ${result.chunks} frammenti nella cartella. La copia legacy browser è stata rimossa.`, "warn"); } catch (error) { showNotice(`Migrazione non completata: ${error.message}. I dati legacy restano nel browser finché non termina la verifica.`, "danger"); if (button) button.disabled = false; } }

async function updateStorage() {
  const bytes = await state.store?.estimate?.() || 0;
  storageStatus.textContent = `Cartella locale: ${(bytes / 1024 / 1024).toFixed(1)} MB media salvati`;
}

async function recoverInterrupted() {
  const sessions = await state.store.all("sessions");
  for (const session of sessions.filter((item) => item.state === "aperta")) {
    const recordings = await state.store.bySession("recordings", session.id);
    for (const recording of recordings.filter((item) => item.status === "in-corso")) {
      const chunks = await state.store.byRecording("chunks", recording.id);
      for (const chunk of chunks.filter(hasStoredBlob)) {
        if (chunk.status !== "salvato") { chunk.status = "salvato"; chunk.persistedAt ||= chunk.verifiedAt || isoNow(); delete chunk.verifiedAt; await state.store.put("chunks", chunk); }
      }
      const closed = closeRecording(recording, session, "interrotta", "riapertura dopo chiusura o crash");
      await state.store.put("recordings", closed);
      const gap = gapAfterSaved(closed, chunks, "intervallo dopo l'ultimo frammento salvato", "incerta");
      if (gap) await state.store.put("gaps", { id: id("gap"), ...gap, createdAt: isoNow() });
      session.state = "interrotta/in attesa di scelta"; session.updatedAt = isoNow(); await state.store.put("sessions", session);
    }
  }
}

function showNotice(text, tone = "") { const current = document.querySelector("#notice"); if (current) current.remove(); view.insertAdjacentHTML("afterbegin", `<div id="notice" class="callout ${tone}">${esc(text)}</div>`); }
function setView(name) { state.view = name; document.querySelectorAll(".nav").forEach((button) => button.classList.toggle("active", button.dataset.view === name)); return render(); }

async function render() {
  if (!state.store) return;
  if (state.view === "home") return renderHome();
  if (state.view === "capture") return renderCapture();
  if (state.view === "search") return renderSearch();
  return renderVerification();
}

async function renderHome() {
  const sessions = (await state.store.all("sessions")).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  if (!sessions.length) { view.innerHTML = `${state.legacyAvailable ? `<div class="callout warn">Dati legacy browser rilevati. <button class="secondary compact" data-action="migrate-legacy">Migra dati browser</button></div>` : ""}${document.querySelector("#empty-template").innerHTML}`; return; }
  view.innerHTML = `<header><div><h1>Sessioni</h1><p class="muted">Episodi salvati nella cartella locale scelta.</p></div><div class="actions">${state.legacyAvailable ? `<button class="secondary" data-action="migrate-legacy">Migra dati browser</button>` : ""}<button data-action="new-session">Nuova sessione</button></div></header><div class="session-list">${sessions.map((session) => `<article class="session-row" data-action="open-session" data-id="${session.id}"><div class="grow"><strong>${esc(session.title)}</strong><p class="small muted">${localDate(session.updatedAt)} · ${session.timezone}</p></div><span class="status ${session.state === "conclusa" ? "ok" : "warn"}">${esc(session.state)}</span></article>`).join("")}</div>`;
}

async function selectedSession() { return state.selectedId ? state.store.get("sessions", state.selectedId) : null; }
async function renderCapture() {
  const session = await selectedSession();
  if (!session) { view.innerHTML = `<div class="empty"><h2>Scegli una sessione</h2><p>La cattura appartiene sempre a una sessione nominabile.</p><button data-action="new-session">Crea sessione</button></div>`; return; }
  const recordings = await state.store.bySession("recordings", session.id), gaps = await state.store.bySession("gaps", session.id), notes = await state.store.bySession("notes", session.id), events = await state.store.bySession("events", session.id), runs = await state.store.bySession("transcriptRuns", session.id), segments = await state.store.bySession("transcriptSegments", session.id);
  const allChunks = (await state.store.all("chunks")).filter((chunk) => chunk.sessionId === session.id).sort((a, b) => a.startMs - b.startMs);
  const active = state.recording?.sessionId === session.id;
  const hasDisplayAudio = !!state.display?.getAudioTracks().length;
  const displaySurface = state.displayInfo?.surface || "non selezionato";
  const completeReady = captureIsLive({ displaySurface, displayTracks: state.display?.getTracks().map((track) => track.readyState) || [], microphoneTracks: state.mic?.getTracks().map((track) => track.readyState) || [], systemTest: state.tests.system, microphoneTest: state.tests.mic });
  const activeSegments = segments.filter((segment) => runs.some((run) => run.id === segment.runId && run.active));
  const items = [...recordings.map((r) => ({ type: "Registrazione", at: r.offsetStartMs, text: `${r.mode} · ${r.status}${r.cause ? ` (${r.cause})` : ""}`, gap: r.status === "interrotta" })), ...gaps.map((g) => ({ type: "Lacuna", at: g.startMs, text: g.cause, gap: true })), ...events.map((e) => ({ type: "Evento", at: e.startMs ?? 0, text: e.text })), ...notes.map((n) => ({ type: "Nota", at: n.startMs ?? 0, text: n.text })), ...activeSegments.map((s) => ({ type: s.source === "microfono" ? "Microfono" : "Audio del computer", at: s.startMs ?? recordings.find((r) => r.id === s.recordingId)?.offsetStartMs ?? 0, text: s.text, transcription: true, segmentId: s.id, untimed: !s.timed }))].sort((a, b) => a.at - b.at);
  const chunkRows = allChunks.map((chunk) => { const saved = hasStoredBlob(chunk), focus = state.jumpOffset != null && chunk.startMs <= state.jumpOffset && chunk.endMs >= state.jumpOffset; return `<div class="split ${focus ? "focus" : ""}"><div><span class="status ${saved ? "ok" : "fail"}">${saved ? "salvato" : "media mancante"}</span> <strong>${esc(chunk.stream)}</strong> <span class="small muted">${formatTime(chunk.startMs)}–${formatTime(chunk.endMs)} · ${(chunk.bytes / 1024 / 1024).toFixed(2)} MB</span></div><button class="secondary compact" data-action="play-block" data-id="${chunk.id}" ${saved ? "" : "disabled"}>Apri flusso</button></div>`; }).join("");
  view.innerHTML = `<header><div><h1>${esc(session.title)}</h1><p class="muted">${esc(session.state)} · inizio ${localDate(session.startedAt)}</p></div><div class="actions"><button class="secondary compact" data-action="rename-session">Rinomina</button><button class="secondary compact" data-action="export-session">Esporta</button><button class="secondary compact" data-action="delete-session">Rimuovi</button></div></header>
  ${session.attestation ? `<div class="callout">Attestazione resa il ${localDate(session.attestation.at)}. Non certifica policy o consenso di altre persone.</div>` : `<div class="callout warn"><strong>Attestazione richiesta.</strong> Prima di una cattura, dichiara di aver verificato gli obblighi applicabili.</div>`}
  <div class="grid"><section class="card"><h2>Preflight dei flussi</h2><p class="muted">Scegli il monitor e l’audio del computer in Chrome; il microfono è richiesto separatamente.</p>
  ${streamRow("Monitor + audio computer", state.display, state.displayInfo ? `${displaySurface}; audio ${hasDisplayAudio ? "presente" : "assente"}` : "non richiesto", "request-display", active)}
  ${streamRow("Microfono", state.mic, streamState(state.mic), "request-mic", active)}
  <div class="actions"><button class="secondary compact" data-action="sample-system" ${!state.display || !hasDisplayAudio || active ? "disabled" : ""}>Prova audio computer</button><button class="secondary compact" data-action="sample-mic" ${!state.mic || active ? "disabled" : ""}>Prova microfono</button></div>
  ${testRow("Sistema", state.tests.system)}${testRow("Microfono", state.tests.mic)}
  <label>Formato del prossimo tratto<select id="capture-format" ${active ? "disabled" : ""}><option value="video" ${state.captureFormat === "video" ? "selected" : ""}>Video con audio</option><option value="audio" ${state.captureFormat === "audio" ? "selected" : ""}>Solo audio (il picker schermo resta necessario per l'audio del computer)</option></select></label>
  <label class="small"><input id="reduced-optin" type="checkbox" ${completeReady ? "" : ""}> Accetto esplicitamente una registrazione <strong>ridotta</strong> se la prova completa non è pronta.</label>
  <div class="actions">${!session.attestation ? `<button data-action="attest">Rendi attestazione</button>` : active ? `<button class="danger" data-action="pause">Pausa / ferma tratto</button><button class="secondary" data-action="conclude">Concludi sessione</button>` : `<button data-action="start-capture" ${session.state === "conclusa" ? "disabled" : ""}>Avvia cattura</button><button class="secondary" data-action="conclude" ${session.state === "conclusa" ? "disabled" : ""}>Concludi sessione</button>`}</div>
  ${active ? `<p class="small"><span class="status ok">in corso</span> Un recorder continuo per flusso salva frammenti progressivi ogni ${CHUNK_MS / 1000}s, senza stop/start fra loro.</p>` : `<p class="small muted">${completeReady ? "Modalità completa pronta." : "La modalità completa richiede monitor, due tracce audio e i due riascolti positivi."}</p>`}</section>
  <section class="card"><h2>Stato e recupero</h2><div id="capture-status">${renderCaptureStatus(recordings)}</div>${recordings.length ? `<div class="session-list">${recordings.sort((a, b) => b.offsetStartMs - a.offsetStartMs).map((recording) => `<div class="split small"><span>${formatTime(recording.offsetStartMs)} · ${esc(recording.mode)} · ${esc(recording.status)}</span><div class="actions"><button class="secondary compact" data-action="transcribe-recording" data-id="${recording.id}" ${state.asr.job || recording.status === "in-corso" ? "disabled" : ""}>Trascrivi tratto</button><button class="secondary compact" data-action="export-recording" data-id="${recording.id}">Esporta tratto</button></div></div>`).join("")}</div>` : ""}<p class="small muted">Una chiusura o perdita di flusso crea un’interruzione e non viene mai rappresentata come contenuto acquisito.</p></section>
  <section class="card"><h2>Aggiungi contesto</h2><form data-form="note"><label>Nota libera<textarea name="text" required placeholder="Riflessione o contesto"></textarea></label><button>Salva nota</button></form><form data-form="event"><label>Evento fattuale<textarea name="text" required placeholder="Ad esempio: decisione presa"></textarea></label><button class="secondary">Aggiungi evento</button></form></section>
  <section class="card wide"><h2>Trascrizione locale</h2><p class="small muted">Parte soltanto dopo il clic su “Trascrivi”. Microfono e audio del computer restano sorgenti separate. I risultati restano nella cartella archivio.</p><div class="grid"><label>Percorso<select id="asr-path"><option value="browser" ${state.asr.path === "browser" ? "selected" : ""}>Nel browser</option><option value="local" ${state.asr.path === "local" ? "selected" : ""}>Motore locale sul computer</option></select></label>${state.asr.path === "browser" ? `<label>Livello<select id="asr-tier">${Object.entries(BROWSER_TIERS).map(([key, tier]) => `<option value="${key}" ${state.asr.tier === key ? "selected" : ""} ${tier.gated ? "disabled" : ""}>${tier.label}${tier.gated ? " — in attesa di benchmark" : " — sperimentale"}</option>`).join("")}</select></label>` : `<label>URL completo loopback<input id="asr-url" type="url" value="${esc(state.asr.url)}" placeholder="http://127.0.0.1:8765/asr"></label>`}</div>${state.asr.path === "browser" ? `<p class="small">Candidato: <a href="https://huggingface.co/${BROWSER_TIERS[state.asr.tier].model}" target="_blank" rel="noopener">${esc(BROWSER_TIERS[state.asr.tier].model)}</a> · ONNX ${BROWSER_TIERS[state.asr.tier].dtype}/${BROWSER_TIERS[state.asr.tier].device} · download stimato ${BROWSER_TIERS[state.asr.tier].estimate}. La qualità e la parità Mac/Windows non sono ancora validate.</p><button class="secondary compact" data-action="prepare-browser" ${state.asr.loading ? "disabled" : ""}>${state.asr.loading || "Prepara modello con download esplicito"}</button>` : `<p class="small">Preflight GET sullo stesso URL; al clic “Trascrivi” viene inviato soltanto WAV audio mono 16 kHz. Nessun video, nota o titolo.</p>`}<div class="actions"><button data-action="transcribe-session" ${!recordings.some((r) => r.status !== "in-corso") || state.asr.job ? "disabled" : ""}>Trascrivi sessione</button>${state.asr.job ? `<button class="danger" data-action="cancel-asr">Annulla ASR</button><span id="asr-progress" class="status warn">${esc(state.asr.job.progress)}</span>` : ""}</div><h3>Versioni e risultati</h3>${runs.length ? runs.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || ""))).map((run) => `<div class="split small"><div><span class="status ${run.status === "completa" ? "ok" : run.status === "errore" ? "fail" : "warn"}">${esc(run.status)}</span> ${run.source === "microfono" ? "Microfono" : "Audio del computer"} · ${esc(run.path)}${run.kind === "correzione" ? " · correzione" : ""} · ${esc(run.model || run.tier || "")} · ${localDate(run.createdAt)}${run.error ? `<p class="muted">${esc(run.error)}</p>` : ""}<p class="muted">${run.coverage?.length || 0} intervalli elaborati${run.partialMedia ? " · media incompleto" : ""}</p></div><div class="actions"><button class="secondary compact" data-action="activate-run" data-id="${run.id}" ${run.active ? "disabled" : ""}>Mostra versione</button><button class="secondary compact" data-action="delete-run" data-id="${run.id}">Rimuovi</button></div></div>`).join("") : `<p class="muted">Nessuna trascrizione disponibile; assenza di testo non significa silenzio nel media.</p>`}</section>
  <section class="card wide"><h2>Riproduzione dei flussi salvati</h2>${state.jumpOffset != null ? `<p class="callout">Punto richiesto: ${formatTime(state.jumpOffset)}. Il frammento evidenziato contiene il timestamp cercato.</p>` : ""}${allChunks.length ? `<p class="small muted">Ogni frammento è salvato separatamente, ma viene aperto ricomponendo il flusso del tratto dall'inizio: i frammenti successivi non sono file autonomi.</p><div class="session-list">${chunkRows}</div>` : `<p class="muted">I frammenti media salvati appariranno qui.</p>`}</section>
  <section class="card wide"><h2>Timeline della sessione</h2>${items.length ? `<div class="timeline">${items.map((item) => `<div class="timeline-item ${item.gap ? "gap" : ""}"><span class="chip">${item.untimed ? "senza timestamp" : formatTime(item.at)}</span><strong> ${item.type}</strong><p>${esc(item.text)}</p>${item.transcription ? `<button class="secondary compact" data-action="edit-segment" data-id="${item.segmentId}">Correggi testo</button>` : ""}</div>`).join("")}</div>` : `<p class="muted">Ancora nessun tratto, nota o evento.</p>`}</section></div>`;
  if (state.asr.path === "browser") {
    const asrPanel = [...view.querySelectorAll(".card.wide")].find((section) => section.querySelector("h2")?.textContent === "Trascrizione locale");
    const modelBytes = Object.values(LARGE_MODEL_ASSETS).reduce((sum, bytes) => sum + bytes, 0);
    asrPanel?.insertAdjacentHTML("beforeend", `<div class="callout"><strong>Massima qualità: preparazione per verifica</strong><p class="small">Fonte: <a href="https://huggingface.co/onnx-community/whisper-large-v3-turbo" target="_blank" rel="noopener">onnx-community/whisper-large-v3-turbo</a>, revisione ${LARGE_MODEL_REVISION.slice(0, 12)}. I pesi e metadati (${(modelBytes / 1_000_000).toFixed(0)} MB) sono salvati in <code>modelli/whisper-large-v3-turbo-q4f16/</code> nella cartella archivio scelta. Lo spazio libero della cartella non è misurato. Il livello resta indisponibile finché benchmark e prova offline Mac/Windows non sono conclusi.</p><button class="secondary compact" data-action="prepare-maximum-files" ${state.asr.loading ? "disabled" : ""}>Scarica i file Massima per verifica</button>${state.asr.modelDownload ? ` <button class="danger compact" data-action="cancel-maximum-files">Annulla download</button>` : ""}</div>`);
  }
  refreshMeters();
  if (state.jumpOffset != null) requestAnimationFrame(() => document.querySelector(".focus")?.scrollIntoView({ block: "center", behavior: "smooth" }));
}
function streamRow(label, stream, detail, action, disabled = false) { const live = streamState(stream) === "live"; return `<div class="stream"><i class="dot ${live ? "live" : ""}"></i><div><strong>${label}</strong><div class="small muted">${esc(detail)}</div><div class="meter"><i id="meter-${action}"></i></div></div><button class="secondary compact" data-action="${action}" ${disabled ? "disabled" : ""}>${live ? "Rifai" : "Richiedi"}</button></div>`; }
function testRow(label, test) { return `<p class="small"><span class="status ${test?.passed ? "ok" : test ? "warn" : ""}">${label}: ${test?.passed ? "riascolto confermato" : test?.url ? "campione pronto" : "non verificato"}</span>${test?.url ? ` <button class="secondary compact" data-action="play-test" data-kind="${label === "Sistema" ? "system" : "mic"}">Riascolta</button><button class="compact" data-action="confirm-test" data-kind="${label === "Sistema" ? "system" : "mic"}">Segna riconoscibile</button>` : ""}</p>`; }
function renderCaptureStatus(recordings) { const latest = recordings.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]; return latest ? `<p><span class="status ${latest.status === "interrotta" ? "fail" : latest.status === "terminata" ? "ok" : "warn"}">${esc(latest.status)}</span></p><p class="small">${esc(latest.cause || "Nessuna causa di arresto")}</p>` : `<p class="muted">Nessun tratto salvato.</p>`; }

async function renderSearch() {
  const sessions = (await state.store.all("sessions")).sort((a, b) => a.title.localeCompare(b.title));
  view.innerHTML = `<header><div><h1>Ricerca</h1><p class="muted">Titoli, note, eventi e trascrizioni effettivamente presenti.</p></div></header><section class="card"><form data-form="search"><label>Termine<input name="query" autofocus required placeholder="Cerca nella cronologia"></label><div class="grid"><label>Da<input name="from" type="date"></label><label>A<input name="to" type="date"></label><label>Sessione<select name="sessionId"><option value="">Tutte le sessioni</option>${sessions.map((session) => `<option value="${esc(session.id)}">${esc(session.title)}</option>`).join("")}</select></label></div><button>Cerca</button></form><div id="results" class="session-list"></div></section>`;
}
async function renderVerification() {
  view.innerHTML = `<header><div><h1>Verifica e limiti</h1><p class="muted">Lo sviluppo locale non sostituisce le prove sulla build Chrome/macOS.</p></div></header><section class="card"><h2>Stato della trascrizione</h2><ul class="checklist"><li>I livelli Rapido e Bilanciato sono candidati sperimentali, non validati con clip italiane su entrambi i sistemi.</li><li>Massima qualità resta disabilitato finché memoria, qualità e parità WebGPU non superano il benchmark.</li><li>L'audio è letto dai frammenti con MediaSource e decodificato progressivamente nel browser; durata lunga e codec reali richiedono prova strumentata.</li><li>Il motore locale accetta soltanto WAV audio su loopback dopo preflight; installazione e prestazioni Mac/Windows richiedono prove target.</li><li>L'uso con dati aziendali richiede verifica separata delle policy applicabili.</li></ul><p><a href="docs/verification/acceptance-matrix-2026-09-22.md" target="_blank">Matrice storica della cattura</a></p></section>`;
}

function onChange(event) {
  if (event.target.id === "asr-path") { state.asr.path = event.target.value; renderCapture(); }
  if (event.target.id === "asr-tier") { state.asr.tier = event.target.value; renderCapture(); }
  if (event.target.id === "asr-url") state.asr.url = event.target.value.trim();
  if (event.target.id === "capture-format") state.captureFormat = event.target.value;
}

async function onClick(event) {
  const button = event.target.closest("[data-action],.nav"); if (!button) return;
  if (button.classList.contains("nav")) return setView(button.dataset.view);
  const action = button.dataset.action;
  if (action === "choose-directory") return chooseDirectory();
  if (action === "reconnect-directory") return reconnectDirectory();
  if (action === "migrate-legacy") return migrateLegacy();
  if (action === "new-session") return openNewSession();
  if (action === "create-session") return createSession(dialog.querySelector("[name=title]")?.value);
  if (action === "rename-session") return openRenameSession();
  if (action === "jump-to") { state.selectedId = button.dataset.id; state.jumpOffset = Number(button.dataset.offset); return setView("capture"); }
  if (action === "open-session") { state.selectedId = button.dataset.id; state.jumpOffset = button.dataset.offset ? Number(button.dataset.offset) : null; return setView("capture"); }
  if (action === "attest") return openAttestation();
  if (action === "request-display") return acquireDisplay();
  if (action === "request-mic") return acquireMic();
  if (action === "sample-system") return sample("system");
  if (action === "sample-mic") return sample("mic");
  if (action === "play-test") return playTest(button.dataset.kind);
  if (action === "confirm-test") return confirmTest(button.dataset.kind);
  if (action === "start-capture") return startCapture();
  if (action === "pause") return stopCapture("terminata", "pausa richiesta");
  if (action === "conclude") return concludeSession();
  if (action === "export-session") return exportSession();
  if (action === "export-recording") return exportScope(button.dataset.id);
  if (action === "play-block") return playBlock(button.dataset.id);
  if (action === "prepare-browser") return prepareBrowser();
  if (action === "prepare-maximum-files") return prepareMaximumFiles();
  if (action === "cancel-maximum-files") { state.asr.modelDownload?.abort(); return; }
  if (action === "transcribe-recording") return startAsr([button.dataset.id]);
  if (action === "transcribe-session") return startAsr();
  if (action === "cancel-asr") { state.asr.job?.controller.abort(); return; }
  if (action === "activate-run") return activateRun(button.dataset.id);
  if (action === "delete-run") return deleteRun(button.dataset.id);
  if (action === "edit-segment") return openSegmentCorrection(button.dataset.id);
  if (action === "delete-session") return confirmDelete();
}
async function onSubmit(event) {
  const form = event.target; if (!form.dataset.form) return; event.preventDefault();
  const data = new FormData(form);
  if (form.dataset.form === "new-session") return createSession(data.get("title"));
  const session = await selectedSession(); if (!session) return;
  if (form.dataset.form === "rename-session") { const title = data.get("title")?.trim(); if (!title) return showNotice("Il titolo non può essere vuoto.", "danger"); session.title = title; session.updatedAt = isoNow(); await state.store.put("sessions", session); dialog.close(); return renderCapture(); }
  if (form.dataset.form === "attest") { session.attestation = { at: isoNow(), textVersion: "v1", declaration: "Ho verificato gli obblighi applicabili prima della cattura." }; session.updatedAt = isoNow(); await state.store.put("sessions", session); dialog.close(); return renderCapture(); }
  if (form.dataset.form === "note" || form.dataset.form === "event") { const at = sessionOffset(session.startedAt); await state.store.put(form.dataset.form === "note" ? "notes" : "events", { id: id(form.dataset.form), sessionId: session.id, recordingId: state.recording?.id ?? null, text: data.get("text").trim(), startMs: at, createdAt: isoNow(), kind: form.dataset.form }); form.reset(); return renderCapture(); }
  if (form.dataset.form === "search") return runSearch(data);
  if (form.dataset.form === "edit-segment") return saveSegmentCorrection(data.get("segmentId"), data.get("text"));
  if (form.dataset.form === "delete") { try { const result = await state.store.deleteSession(session.id); dialog.close(); state.selectedId = null; await updateStorage(); await setView("home"); showNotice(`Sessione rimossa: ${result.recordings} tratti e ${result.chunks} blocchi rimossi dall’archivio controllato dall’app. Esportazioni o backup esterni non sono controllati dall’app.`, "warn"); } catch (error) { showNotice(`Rimozione non completata (${error.name || "errore"}): la sessione non è dichiarata rimossa. Riprova o conserva l’errore per verifica.`, "danger"); } }
}

function openNewSession() { dialog.innerHTML = `<div class="dialog-body"><h2>Nuova sessione</h2><form data-form="new-session"><label>Titolo della sessione<input name="title" required maxlength="120" placeholder="Es. Preparazione presentazione"></label><p class="small muted">Può esistere senza cattura.</p><div class="actions"><button type="button" data-action="create-session">Crea</button><button class="secondary" type="button" onclick="this.closest('dialog').close()">Annulla</button></div></form></div>`; dialog.showModal(); }
async function openRenameSession() { const session = await selectedSession(); dialog.innerHTML = `<div class="dialog-body"><h2>Rinomina sessione</h2><form data-form="rename-session"><label>Titolo<input name="title" maxlength="120" required value="${esc(session.title)}"></label><div class="actions"><button>Salva</button><button class="secondary" type="button" onclick="this.closest('dialog').close()">Annulla</button></div></form></div>`; dialog.showModal(); }
async function createSession(title) { const clean = title?.trim(); if (!clean) return showNotice("Inserisci un titolo per la sessione.", "danger"); const now = isoNow(); const item = { id: id("ses"), title: clean, state: "aperta", startedAt: now, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, createdAt: now, updatedAt: now }; await state.store.put("sessions", item); state.selectedId = item.id; dialog.close(); setView("capture"); }
function openAttestation() { dialog.innerHTML = `<div class="dialog-body"><h2>Attestazione di registrazione</h2><p>Dichiari di aver verificato le regole applicabili e assolto gli obblighi preliminari richiesti per questa sessione con cattura. Non equivale a un’autorizzazione aziendale né prova il consenso di altre persone.</p><form data-form="attest"><label><input type="checkbox" required> Confermo questa dichiarazione</label><div class="actions"><button>Registra attestazione</button><button class="secondary" type="button" onclick="this.closest('dialog').close()">Annulla</button></div></form></div>`; dialog.showModal(); }
async function confirmTest(kind) { const test = state.tests[kind]; if (!test) return; test.passed = true; test.confirmedAt = isoNow(); const session = await selectedSession(); session.preflight = { ...(session.preflight || {}), [kind]: { passed: true, confirmedAt: test.confirmedAt } }; session.updatedAt = isoNow(); await state.store.put("sessions", session); renderCapture(); }

async function acquireDisplay() {
  if (state.capturing) return showNotice("Non puoi cambiare flussi durante una cattura. Metti in pausa il tratto prima.", "warn");
  stopStream(state.display); clearTest("system");
  try { state.display = await navigator.mediaDevices.getDisplayMedia({ video: { displaySurface: "monitor" }, audio: true, systemAudio: "include", preferCurrentTab: false }); const video = state.display.getVideoTracks()[0]; state.displayInfo = { surface: video?.getSettings().displaySurface || "sconosciuto", video: video?.readyState, audioTracks: state.display.getAudioTracks().length }; state.display.getTracks().forEach((track) => track.addEventListener("ended", () => handleTrackEnded("flusso monitor/audio terminato"), { once: true })); if (state.displayInfo.surface !== "monitor") showNotice("È stata scelta una superficie diversa dal monitor: non è modalità completa.", "warn"); }
  catch (error) { showNotice(`Cattura monitor/audio non disponibile: ${error.name}. ${error.message || ""}`, "danger"); state.display = null; state.displayInfo = null; }
  renderCapture();
}
async function acquireMic() { if (state.capturing) return showNotice("Non puoi cambiare flussi durante una cattura. Metti in pausa il tratto prima.", "warn"); stopStream(state.mic); clearTest("mic"); try { state.mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false } }); state.mic.getTracks().forEach((track) => track.addEventListener("ended", () => handleTrackEnded("microfono terminato"), { once: true })); } catch (error) { showNotice(`Microfono non disponibile: ${error.name}. ${error.message || ""}`, "danger"); state.mic = null; } renderCapture(); }
function stopStream(stream) { stream?.getTracks().forEach((track) => track.stop()); }
function clearTest(kind) { if (state.tests[kind]?.url) URL.revokeObjectURL(state.tests[kind].url); state.tests[kind] = null; }
async function handleTrackEnded(cause) { if (state.capturing && !state.stopping) await stopCapture("interrotta", cause); }

async function sample(kind) {
  const track = kind === "system" ? state.display?.getAudioTracks()[0] : state.mic?.getAudioTracks()[0]; if (!track) return showNotice("Traccia audio non presente.", "danger");
  let recorder; try { recorder = new MediaRecorder(new MediaStream([track])); } catch (error) { return showNotice(`Campione non disponibile: ${error.message}`, "danger"); }
  const parts = []; recorder.ondataavailable = (event) => event.data.size && parts.push(event.data);
  recorder.onstop = () => { const blob = new Blob(parts, { type: recorder.mimeType }); state.tests[kind] = { url: URL.createObjectURL(blob), passed: false, createdAt: isoNow() }; renderCapture(); };
  recorder.start(); window.setTimeout(() => recorder.state !== "inactive" && recorder.stop(), 3_000); showNotice(`Campionamento ${kind === "system" ? "dell’audio computer" : "del microfono"} in corso: usa ora il segnale innocuo.`);
}
function playTest(kind) { const test = state.tests[kind]; if (!test?.url) return; dialog.innerHTML = `<div class="dialog-body"><h2>Riascolto separato: ${kind === "system" ? "audio computer" : "microfono"}</h2><audio controls autoplay src="${test.url}"></audio><p class="small">Segna “riconoscibile” solo se il contenuto atteso si sente in questa traccia, non nell’altra.</p><button class="secondary" onclick="this.closest('dialog').close()">Chiudi</button></div>`; dialog.showModal(); }
function refreshMeters() { for (const [key, teardown] of state.meters) teardown(); state.meters.clear(); for (const [kind, stream] of [["request-display", state.display], ["request-mic", state.mic]]) { const track = kind === "request-display" ? stream?.getAudioTracks()[0] : stream?.getAudioTracks()[0]; const el = byId(`meter-${kind}`); if (!track || !el) continue; const ctx = new AudioContext(), analyser = ctx.createAnalyser(), source = ctx.createMediaStreamSource(new MediaStream([track])); analyser.fftSize = 256; source.connect(analyser); const values = new Uint8Array(analyser.frequencyBinCount); let frame; const tick = () => { analyser.getByteTimeDomainData(values); let total = 0; values.forEach((value) => total += Math.abs(value - 128)); el.style.width = `${Math.min(100, total / values.length * 2.2)}%`; frame = requestAnimationFrame(tick); }; tick(); state.meters.set(kind, () => { cancelAnimationFrame(frame); source.disconnect(); ctx.close(); }); } }

function recorderOptions(kind) {
  const candidates = kind === "display" ? ["video/webm;codecs=vp8,opus", "video/webm"] : ["audio/webm;codecs=opus", "audio/webm"];
  const mimeType = candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate));
  return kind === "display" ? { ...(mimeType ? { mimeType } : {}), videoBitsPerSecond: 4_000_000, audioBitsPerSecond: 128_000 } : { ...(mimeType ? { mimeType } : {}), audioBitsPerSecond: 128_000 };
}
class Segmenter {
  constructor(kind, stream, recording, session) { this.kind = kind; this.stream = stream; this.recording = recording; this.session = session; this.recorder = null; this.sequence = 0; this.startedAt = null; this.lastEndMs = null; this.pending = Promise.resolve(); this.stopped = Promise.resolve(); }
  start() {
    this.startedAt = Date.now(); this.lastEndMs = sessionOffset(this.session.startedAt, this.startedAt);
    let settle; this.stopped = new Promise((resolve) => { settle = resolve; });
    try { this.recorder = new MediaRecorder(this.stream, recorderOptions(this.kind)); }
    catch (error) { try { this.recorder = new MediaRecorder(this.stream); } catch { settle(); return failCapture(`MediaRecorder ${this.kind}: ${error.message}`); } }
    const recorder = this.recorder;
    recorder.ondataavailable = (event) => {
      if (!event.data.size) return;
      const interval = continuousBlockInterval({ recordingStartMs: sessionOffset(this.session.startedAt, this.startedAt), previousEndMs: this.lastEndMs, timecodeMs: event.timecode, observedAtMs: sessionOffset(this.session.startedAt) });
      this.lastEndMs = interval.endMs;
      this.pending = this.pending.then(() => saveBlock(this, event.data, interval.startMs, interval.endMs)).catch(async (error) => { await failCapture(`scrittura blocco continuo: ${error.name || "errore"} ${error.message || ""}`); });
    };
    recorder.onerror = (event) => { failCapture(`MediaRecorder ${this.kind}: ${event.error?.name || "errore"} ${event.error?.message || ""}`); };
    recorder.onstop = () => settle();
    recorder.start(CHUNK_MS);
  }
  async finish() { if (this.recorder?.state !== "inactive") this.recorder.stop(); await this.stopped; await this.pending; }
}
async function saveBlock(segmenter, blob, startMs, endMs) {
  const item = { id: id("block"), recordingId: segmenter.recording.id, sessionId: segmenter.session.id, index: segmenter.sequence++, stream: segmenter.kind, startMs, endMs, format: blob.type || "video/webm", bytes: blob.size, status: "salvato", persistedAt: isoNow(), blob, createdAt: isoNow() };
  try { await assertStorage(blob.size); await state.store.put("chunks", item); await updateStorage(); if (state.view === "capture") renderCapture(); }
  catch (error) { await failCapture(`scrittura o quota: ${error.name || "errore"} ${error.message || ""}`); }
}
async function assertStorage(nextBytes) { if (!state.store) throw new DOMException("Cartella locale non collegata", "InvalidStateError"); return { allowed: true, known: false, usage: await state.store.estimate(), quota: 0, projected: nextBytes }; }
async function startCapture() {
  const session = await selectedSession(); const complete = captureIsLive({ displaySurface: state.displayInfo?.surface, displayTracks: state.display?.getTracks().map((track) => track.readyState) || [], microphoneTracks: state.mic?.getTracks().map((track) => track.readyState) || [], systemTest: state.tests.system, microphoneTest: state.tests.mic }); const reduced = byId("reduced-optin")?.checked;
  if (!complete && !reduced) return showNotice("Mancano le prove della modalità completa. Se scegli consapevolmente una modalità ridotta, attiva l’opt-in esplicito.", "warn");
  if (!state.mic || (state.captureFormat === "video" && !state.display)) return showNotice("Seleziona il microfono e, per il video, il monitor.", "danger");
  let storagePreflight; try { storagePreflight = await assertStorage(0); } catch (error) { return showNotice(`Cattura non avviata: ${error.message}. Libera spazio o esporta i dati confermati.`, "danger"); }
  const recording = { ...nextRecording(session, `${state.captureFormat === "audio" ? "solo audio" : "video con audio"} · ${complete ? "completa verificata" : "ridotta con opt-in"}`), captureFormat: state.captureFormat, audioSources: { microfono: true, systemAudio: !!state.display?.getAudioTracks().length }, storagePreflight: { ...storagePreflight, checkedAt: isoNow() } }; state.recording = recording; state.capturing = true; await state.store.put("recordings", recording); state.segmenters = [new Segmenter("microfono", state.mic, recording, session)]; if (state.captureFormat === "video") state.segmenters.unshift(new Segmenter("display", state.display, recording, session)); else if (state.display?.getAudioTracks().length) state.segmenters.unshift(new Segmenter("systemAudio", new MediaStream(state.display.getAudioTracks()), recording, session)); state.segmenters.forEach((segmenter) => segmenter.start()); renderCapture();
}
async function stopCapture(status, cause) { if (!state.recording || state.stopping) return; state.stopping = true; state.capturing = false; const recording = state.recording, session = await state.store.get("sessions", recording.sessionId); await Promise.all(state.segmenters.map((segmenter) => segmenter.finish())); const closed = closeRecording(recording, session, status, cause); await state.store.put("recordings", closed); if (status === "interrotta") { const chunks = await state.store.byRecording("chunks", recording.id), gap = gapAfterSaved(closed, chunks, cause); if (gap) await state.store.put("gaps", { id: id("gap"), ...gap, createdAt: isoNow() }); } session.state = status === "interrotta" ? "interrotta/in attesa di scelta" : "aperta"; session.updatedAt = isoNow(); await state.store.put("sessions", session); state.recording = null; state.segmenters = []; stopStream(state.display); stopStream(state.mic); state.display = state.mic = null; state.displayInfo = null; state.tests = { system: null, mic: null }; state.stopping = false; await updateStorage(); renderCapture(); }
async function failCapture(cause) { if (state.recording) await stopCapture("interrotta", cause); else showNotice(cause, "danger"); }
async function concludeSession() { const session = await selectedSession(); if (state.recording) await stopCapture("terminata", "sessione conclusa"); const latest = await selectedSession(); latest.state = "conclusa"; latest.endedAt = isoNow(); latest.updatedAt = isoNow(); await state.store.put("sessions", latest); renderCapture(); }

async function prepareBrowser() {
  const tier = BROWSER_TIERS[state.asr.tier];
  if (tier.gated) return showNotice("Questo livello attende benchmark Mac e Windows.", "warn");
  if (state.asr.pipelines.has(state.asr.tier)) return showNotice("Modello già pronto in questa sessione.");
  state.asr.loading = "Download e caricamento in corso…"; await renderCapture();
  try {
    const { loadWhisper } = await import("./browser-asr.bundle.js?v=1");
    const pipe = await loadWhisper(tier.model, { device: tier.device, dtype: tier.dtype, modelDirectory: state.rememberedDirectory, progress_callback: (progress) => { const done = Number(progress.progress); if (Number.isFinite(done)) { state.asr.loading = `Modello ${Math.round(done)}%`; const button = document.querySelector('[data-action="prepare-browser"]'); if (button) button.textContent = state.asr.loading; } } });
    state.asr.pipelines.set(state.asr.tier, pipe);
    state.asr.loading = null; await renderCapture(); showNotice(`${tier.label} pronto. Avvia la trascrizione con un clic separato.`, "warn");
  } catch (error) { state.asr.loading = null; await renderCapture(); showNotice(`Modello non pronto: ${error.message}. Verifica rete, memoria e spazio; poi riprova.`, "danger"); }
}

async function prepareMaximumFiles() {
  if (state.asr.loading) return;
  const controller = new AbortController(); state.asr.modelDownload = controller;
  state.asr.loading = "Download Massima in corso…"; await renderCapture();
  try {
    const result = await prepareLargeModelFiles(state.rememberedDirectory, { signal: controller.signal, onProgress: ({ path, completedBytes, totalBytes }) => { const button = document.querySelector('[data-action="prepare-maximum-files"]'); if (button) button.textContent = `${path.split("/").at(-1)} · ${Math.round(completedBytes / totalBytes * 100)}%`; } });
    state.asr.loading = state.asr.modelDownload = null; await renderCapture(); showNotice(`${result.assetCount} file del modello Massima verificati nella cartella scelta (${(result.totalBytes / 1_000_000).toFixed(0)} MB). Il livello attende i benchmark.`, "warn");
  } catch (error) { state.asr.loading = state.asr.modelDownload = null; await renderCapture(); showNotice(error.name === "AbortError" ? "Download annullato. I file già verificati restano nella cartella; puoi riprendere con lo stesso pulsante." : `Preparazione Massima incompleta: ${error.message}. I file già verificati restano nella cartella; riprova dopo aver controllato spazio e rete.`, error.name === "AbortError" ? "warn" : "danger"); }
}

async function activateRun(runId) {
  const selected = await state.store.get("transcriptRuns", runId); if (!selected) return;
  const runs = await state.store.byRecording("transcriptRuns", selected.recordingId);
  for (const run of runs.filter((run) => run.source === selected.source && run.active !== (run.id === runId))) { run.active = run.id === runId; run.updatedAt = isoNow(); await state.store.put("transcriptRuns", run); }
  await renderCapture();
}

async function deleteRun(runId) { await state.store.deleteTranscriptRun(runId); await renderCapture(); }

async function openSegmentCorrection(segmentId) {
  const segment = await state.store.get("transcriptSegments", segmentId); if (!segment) return;
  dialog.innerHTML = `<div class="dialog-body"><h2>Correggi trascrizione</h2><p class="small muted">La correzione crea una nuova versione; l'originale resta consultabile.</p><form data-form="edit-segment"><input type="hidden" name="segmentId" value="${esc(segment.id)}"><label>Testo<textarea name="text" required>${esc(segment.text)}</textarea></label><div class="actions"><button>Salva nuova versione</button><button type="button" class="secondary" onclick="this.closest('dialog').close()">Annulla</button></div></form></div>`;
  dialog.showModal();
}

async function saveSegmentCorrection(segmentId, value) {
  const text = String(value || "").trim(); if (!text) return;
  const original = await state.store.get("transcriptSegments", segmentId); if (!original) return;
  const base = await state.store.get("transcriptRuns", original.runId); if (!base) return;
  const runs = (await state.store.byRecording("transcriptRuns", base.recordingId)).filter((run) => run.source === base.source);
  const corrected = { ...base, id: id("asr"), baseRunId: base.id, kind: "correzione", version: Math.max(...runs.map((run) => run.version || 0)) + 1, active: false, createdAt: isoNow(), updatedAt: isoNow() };
  await state.store.put("transcriptRuns", corrected);
  const segments = (await state.store.byRecording("transcriptSegments", base.recordingId)).filter((segment) => segment.runId === base.id);
  for (const segment of segments) await state.store.put("transcriptSegments", { ...segment, id: id("seg"), runId: corrected.id, text: segment.id === original.id ? text : segment.text, correctedFromId: segment.id, correctedAt: segment.id === original.id ? isoNow() : null });
  for (const run of runs.filter((run) => run.active)) { run.active = false; await state.store.put("transcriptRuns", run); }
  corrected.active = true; await state.store.put("transcriptRuns", corrected);
  dialog.close(); await renderCapture();
}

async function startAsr(recordingIds = null) {
  if (state.asr.job) return;
  if (byId("asr-url")) state.asr.url = byId("asr-url").value.trim();
  const session = await selectedSession(); if (!session) return;
  const recordings = (await state.store.bySession("recordings", session.id)).filter((recording) => recording.status !== "in-corso" && (!recordingIds || recordingIds.includes(recording.id)));
  if (!recordings.length) return showNotice("Nessun tratto salvato e concluso da trascrivere.", "warn");
  let local = null, pipe = null;
  try {
    if (state.asr.path === "local") local = await preflightLocalAsr(state.asr.url);
    else {
      if (BROWSER_TIERS[state.asr.tier].gated) throw new Error("Livello non ancora validato sui sistemi target.");
      pipe = state.asr.pipelines.get(state.asr.tier);
      if (!pipe) throw new Error("Prepara il modello browser con il pulsante di download prima di trascrivere.");
    }
  } catch (error) { return showNotice(`ASR non avviata: ${error.message}`, "danger"); }
  const controller = new AbortController(); state.asr.job = { controller, progress: "Preparazione audio" }; await renderCapture();
  const execute = async () => {
    for (const recording of recordings) {
      if (controller.signal.aborted) break;
      const chunks = await state.store.byRecording("chunks", recording.id);
      for (const [stream, source] of [["microfono", "microfono"], ["systemAudio", "audio del computer"], ["display", "audio del computer"]]) {
        const same = chunks.filter((chunk) => chunk.stream === stream);
        if (!same.length || (source === "audio del computer" && recording.audioSources?.systemAudio === false) || (stream === "display" && chunks.some((chunk) => chunk.stream === "systemAudio"))) continue;
        await transcribeSource(session, recording, source, same, local, pipe, controller.signal);
        if (controller.signal.aborted) break;
      }
    }
  };
  try {
    if (navigator.locks?.request) await navigator.locks.request("diario-asr-jobs", execute);
    else await execute();
  } finally { state.asr.job = null; await renderCapture(); }
}

async function transcribeSource(session, recording, source, chunks, local, pipe, signal) {
  const path = local ? "motore locale" : "browser", tier = local ? null : state.asr.tier, model = local?.info.model || BROWSER_TIERS[tier].model;
  const prior = (await state.store.byRecording("transcriptRuns", recording.id)).filter((run) => run.source === source);
  const run = { id: id("asr"), sessionId: session.id, recordingId: recording.id, source, path, tier, model, version: prior.length + 1, status: "in attesa", coverage: [], mediaChunkIds: [], active: false, error: null, createdAt: isoNow(), updatedAt: isoNow() };
  await state.store.put("transcriptRuns", run);
  try {
    const media = contiguousMedia(chunks); run.partialMedia = media.partial; run.mediaChunkIds = media.chunks.map((chunk) => chunk.id); run.status = "in elaborazione"; run.updatedAt = isoNow(); await state.store.put("transcriptRuns", run);
    state.asr.job.progress = `${source}: ${formatTime(recording.offsetStartMs)}`; await renderCapture();
    let processedWindows = 0, hadAudioSignal = false;
    for await (const window of audioWindows(state.store, media, signal)) {
      if (signal.aborted) throw new DOMException("Trascrizione annullata", "AbortError");
      processedWindows += 1;
      state.asr.job.progress = `${source}: ${formatTime(window.startMs)}–${formatTime(window.endMs)}`; const status = byId("asr-progress"); if (status) status.textContent = state.asr.job.progress;
      const durationMs = window.endMs - window.startMs;
      let normalized;
      const hasSignal = window.samples.some((sample) => Math.abs(sample) > 0.0001);
      hadAudioSignal ||= hasSignal;
      if (!hasSignal) normalized = [];
      else if (local) {
        const payload = await transcribeLocal(local, window.samples, signal);
        normalized = normalizeSegments(payload, window.startMs, durationMs);
      } else {
        const result = await pipe(window.samples, { language: "italian", task: "transcribe", return_timestamps: true });
        normalized = normalizeBrowserResult(result, window.startMs, durationMs);
      }
      if (hasSignal && !normalized.length) throw new Error("ASR senza testo su audio con segnale: finestra non risolta, mantengo la versione precedente.");
      for (const segment of normalized) await state.store.put("transcriptSegments", { id: id("seg"), runId: run.id, sessionId: session.id, recordingId: recording.id, source, ...segment, mediaChunkIds: window.mediaChunkIds, model, createdAt: isoNow() });
      run.coverage.push({ startMs: window.startMs, endMs: window.endMs, mediaChunkIds: window.mediaChunkIds }); run.status = "parziale"; run.updatedAt = isoNow(); await state.store.put("transcriptRuns", run);
    }
    if (!processedWindows) throw new Error("Nessuna traccia audio decodificata dal flusso media.");
    if (source === "audio del computer" && !hadAudioSignal && recording.audioSources?.systemAudio == null) throw new Error("Nessun segnale audio verificabile nel video storico; traccia del computer non confermata.");
    run.status = run.partialMedia ? "parziale" : "completa";
    if (run.partialMedia) run.error = "Sequenza media interrotta: elaborata soltanto la parte continua dall'header.";
    for (const old of prior.filter((item) => item.active)) { old.active = false; await state.store.put("transcriptRuns", old); }
    run.active = true; run.updatedAt = isoNow(); await state.store.put("transcriptRuns", run);
  } catch (error) {
    run.status = signal.aborted ? "annullata" : run.coverage.length ? "parziale" : "errore";
    run.error = error.message; run.updatedAt = isoNow(); await state.store.put("transcriptRuns", run);
    showNotice(`${source}: ${error.message}`, "danger");
  }
}

async function runSearch(data) { const [sessions, notes, events, transcriptSegments, transcriptRuns] = await Promise.all([state.store.all("sessions"), state.store.all("notes"), state.store.all("events"), state.store.all("transcriptSegments"), state.store.all("transcriptRuns")]); const from = data.get("from") ? new Date(data.get("from")).getTime() : 0, to = data.get("to") ? new Date(`${data.get("to")}T23:59:59`).getTime() : Infinity, sessionId = data.get("sessionId"); const visible = sessions.filter((session) => { const time = new Date(session.startedAt).getTime(); return time >= from && time <= to && (!sessionId || session.id === sessionId); }); const hits = searchDocuments(data.get("query"), { sessions: visible, notes, events, transcriptSegments, transcriptRuns }).filter((hit) => visible.some((session) => session.id === hit.sessionId)); const target = byId("results"); target.innerHTML = hits.length ? hits.map((hit) => `<article class="result"><span class="chip">${esc(hit.kind)}</span><span class="small muted">${esc(hit.textStatus || "")}</span><p>${esc(hit.text)}</p><button class="secondary compact" data-action="open-session" data-id="${hit.sessionId}" data-offset="${hit.offsetMs ?? ""}">${hit.offsetMs != null ? `Apri a ${formatTime(hit.offsetMs)}` : "Apri sessione"}</button></article>`).join("") : `<p class="muted">Nessun risultato nel testo presente; ciò non prova silenzio nel media.</p>`; }
async function exportSession() { return exportScope(); }
async function exportScope(recordingId = null) {
  const session = await selectedSession(), stem = `${safeFileName(session.title)}${recordingId ? `-${recordingId.slice(-6)}` : ""}`, suggested = `${stem}-export.zip`;
  const [allRecordings, chunks, notes, events, gaps, transcriptRuns, transcriptSegments] = await Promise.all([state.store.bySession("recordings", session.id), state.store.all("chunks"), state.store.bySession("notes", session.id), state.store.bySession("events", session.id), state.store.bySession("gaps", session.id), state.store.bySession("transcriptRuns", session.id), state.store.bySession("transcriptSegments", session.id)]);
  const recordings = recordingId ? allRecordings.filter((item) => item.id === recordingId) : allRecordings;
  if (recordingId && recordings.length !== 1) return showNotice("Export del tratto non disponibile: il tratto non è più presente localmente.", "danger");
  const scope = recordingId ? recordingExportScope(recordings[0], sessionOffset(session.startedAt)) : null, intervalStart = scope?.startMs ?? -Infinity, intervalEnd = scope?.endMs ?? Infinity, inScope = (item) => !recordingId || overlapsScope(item, intervalStart, intervalEnd);
  const allRelevant = chunks.filter((chunk) => chunk.sessionId === session.id && (!recordingId || chunk.recordingId === recordingId)).sort((a, b) => a.startMs - b.startMs);
  const readable = await Promise.all(allRelevant.map(async (chunk) => hasStoredBlob(chunk) ? { ...chunk, blob: await state.store.readFragment(chunk) } : chunk));
  const mediaGroups = exportMediaGroups(readable), media = mediaGroups.filter((group) => group.blob), savedBlocks = readable.filter(hasStoredBlob);
  const rawEntries = savedBlocks.map((chunk) => ({ name: `frammenti/${chunk.path || `${chunk.recordingId}-${chunk.stream}-${chunk.index}`}`.replace(/^sessions\//, ""), data: chunk.blob }));
  const fileByChunkId = new Map(media.flatMap((group) => group.chunks.map((chunk) => [chunk.id, group.file]))), rawFileByChunkId = new Map(savedBlocks.map((chunk, index) => [chunk.id, rawEntries[index].name]));
  const relevantGaps = gaps.filter(inScope), scopedNotes = notes.filter(inScope), scopedEvents = events.filter(inScope), streams = Object.groupBy(allRelevant, (chunk) => chunk.stream);
  const manifest = { schemaVersion: 6, exportedAt: isoNow(), scope: { kind: recordingId ? "singolo tratto" : "sessione integrale", sessionId: session.id, parentSession: recordingId ? { id: session.id, title: session.title } : null, recordingId, interval: scope }, session, recordings, streams: Object.fromEntries(Object.entries(streams).map(([stream, blocks]) => [stream, { savedBlocks: blocks.filter(hasStoredBlob).length, mediaFiles: mediaGroups.filter((group) => group.stream === stream).map((group) => ({ recordingId: group.recordingId, file: group.blob ? group.file : null, startsWithRecorderHeader: group.startsWithHeader, continuous: group.continuous, includedBlockIds: group.chunks.map((chunk) => chunk.id), savedButNotIncludedBlockIds: group.skippedChunks.map((chunk) => chunk.id) })) }])), media: mediaGroups.map((group) => ({ recordingId: group.recordingId, stream: group.stream, format: group.format, file: group.blob ? group.file : null, startsWithRecorderHeader: group.startsWithHeader, continuous: group.continuous, includedBlockIds: group.chunks.map((chunk) => chunk.id), savedButNotIncludedBlockIds: group.skippedChunks.map((chunk) => chunk.id) })), notes: scopedNotes, events: scopedEvents, gaps: relevantGaps, chunks: allRelevant.map(({ status, verifiedAt, persistedAt, ...metadata }) => ({ ...metadata, persistence: hasStoredBlob(metadata) ? "salvato" : "media mancante", persistedAt: persistedAt || verifiedAt || null, file: fileByChunkId.get(metadata.id) || null, rawFile: rawFileByChunkId.get(metadata.id) || null })), notices: ["Questo export contiene esclusivamente media e metadati locali; nessuna trascrizione è generata o inclusa.", "Ogni file media riapribile ricompone, in ordine, frammenti letti dalla cartella per un solo recorder e flusso.", "Ogni frammento salvato è incluso anche separatamente in frammenti/, anche quando non può essere dichiarato un file multimediale riapribile."] };
  manifest.schemaVersion = 7;
  manifest.transcriptRuns = transcriptRuns.filter((run) => !recordingId || run.recordingId === recordingId);
  manifest.transcriptSegments = transcriptSegments.filter((segment) => !recordingId || segment.recordingId === recordingId);
  manifest.notices[0] = "Trascrizioni presenti incluse con sorgente, versione, stato, copertura e lacune; assenza di testo non prova silenzio nel media.";
  const activeRunIds = new Set(manifest.transcriptRuns.filter((run) => run.active).map((run) => run.id));
  const transcriptText = manifest.transcriptSegments.filter((segment) => activeRunIds.has(segment.runId)).sort((a, b) => (a.startMs ?? Infinity) - (b.startMs ?? Infinity) || String(a.source).localeCompare(String(b.source))).map((segment) => `${segment.timed ? formatTime(segment.startMs) : "senza timestamp"} [${segment.source}] ${segment.text}`).join("\n");
  const entries = [{ name: "manifest.json", data: JSON.stringify(manifest, null, 2) }, { name: "trascrizione-attiva.txt", data: transcriptText }, ...media.map((group) => ({ name: group.file, data: group.blob })), ...rawEntries], size = media.reduce((total, group) => total + group.blob.size, 0) + rawEntries.reduce((total, entry) => total + entry.data.size, 0);
  const picker = window.showSaveFilePicker?.({ suggestedName: suggested, types: [{ description: "Archivio Diario", accept: { "application/zip": [".zip"] } }] }); let writable = null;
  if (picker) { try { writable = await (await picker).createWritable(); } catch (error) { if (error.name === "AbortError") return showNotice("Export annullato: nessun file creato."); showNotice(`Destinazione streaming non disponibile (${error.name}); preparo un archivio in memoria.`, "warn"); } }
  try { if (writable) await streamZip(entries, writable); else { if (size > 300 * 1024 * 1024) throw new Error("Archivio oltre 300 MB: usa Chrome con il salvataggio streaming disponibile e scegli una destinazione locale."); download(await createZip(entries), suggested); } showNotice(`Export concluso: ZIP con manifest, ${media.length} flussi ricomposti e tutti i ${savedBlocks.length} frammenti salvati in frammenti/. Riaprilo sul target per la prova richiesta.`, "warn"); } catch (error) { try { await writable?.abort(); } catch {} showNotice(`Export non concluso: ${error.message}. I dati locali restano disponibili.`, "danger"); }
}
async function playBlock(chunkId) { const chunk = await state.store.get("chunks", chunkId); if (!chunk || !hasStoredBlob(chunk)) return showNotice("Il media di questo frammento non è presente nella cartella.", "danger"); const stored = await state.store.byRecording("chunks", chunk.recordingId), readable = await Promise.all(stored.map(async (item) => hasStoredBlob(item) ? { ...item, blob: await state.store.readFragment(item) } : item)), groups = exportMediaGroups(readable), group = groups.find((candidate) => candidate.chunks.some((item) => item.id === chunk.id)); if (!group?.blob) return showNotice("Questo frammento è salvato, ma manca l'header iniziale o una sequenza continua per ricomporre un file apribile. L'export lo dichiara nel manifest senza fingere una riproduzione.", "warn"); const url = URL.createObjectURL(group.blob), tag = chunk.stream === "display" ? "video" : "audio", offset = state.jumpOffset == null ? 0 : Math.max(0, (state.jumpOffset - group.chunks[0].startMs) / 1000); dialog.innerHTML = `<div class="dialog-body"><h2>Flusso ricomposto ${esc(chunk.stream)} · ${formatTime(group.chunks[0].startMs)}</h2><${tag} id="playback-media" controls src="${url}"></${tag}><p class="small">${group.chunks.length} frammenti letti dalla cartella sono ricomposti in un solo flusso. ${offset ? `Avvio richiesto a ${formatTime(state.jumpOffset)}.` : ""} Il riascolto non colma intervalli mancanti.</p><button class="secondary" onclick="this.closest('dialog').close()">Chiudi</button></div>`; const media = dialog.querySelector("#playback-media"); media.addEventListener("loadedmetadata", () => { if (Number.isFinite(media.duration)) media.currentTime = Math.min(offset, Math.max(0, media.duration - .05)); media.play().catch(() => {}); }, { once: true }); dialog.addEventListener("close", () => URL.revokeObjectURL(url), { once: true }); dialog.showModal(); }
function download(blob, name) { const url = URL.createObjectURL(blob), link = document.createElement("a"); link.href = url; link.download = name; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 10_000); }
async function confirmDelete() { const session = await selectedSession(); dialog.innerHTML = `<div class="dialog-body"><h2>Rimuovere “${esc(session.title)}”?</h2><p>Verranno rimossi sessione, tratti, blocchi, note, eventi, lacune, run e segmenti di trascrizione dalla cartella scelta. Gli export e i backup esterni non vengono trovati o eliminati.</p><form data-form="delete"><div class="actions"><button class="danger">Rimuovi dati locali</button><button type="button" class="secondary" onclick="this.closest('dialog').close()">Annulla</button></div></form></div>`; dialog.showModal(); }

init();
