import { captureIsLive, CHUNK_MS, continuousBlockInterval, DiaryStore, closeRecording, exportMediaGroups, formatTime, gapAfterSaved, hasStoredBlob, id, isoNow, nextRecording, overlapsScope, recordingExportScope, safeFileName, searchDocuments, sessionOffset, storageAdmission } from "./core.js?v=12";
import { createZip, streamZip } from "./zip.js?v=2";
const state = { store: null, view: "home", selectedId: null, jumpOffset: null, display: null, mic: null, displayInfo: null, tests: { system: null, mic: null }, meters: new Map(), recording: null, segmenters: [], capturing: false, stopping: false };
const view = document.querySelector("#view"), dialog = document.querySelector("#dialog"), storageStatus = document.querySelector("#storage-status");
const esc = (value = "") => String(value).replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char]);
const byId = (id) => document.getElementById(id);
const localDate = (iso) => iso ? new Intl.DateTimeFormat("it-IT", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso)) : "—";
const streamState = (stream) => stream?.getTracks().some((track) => track.readyState === "live") ? "live" : "assente";

async function init() {
  if (!window.isSecureContext) showNotice("Questa app richiede localhost o HTTPS per chiedere le catture.", "danger");
  try { state.store = await new DiaryStore().open(); await state.store.delete("settings", "asr-settings"); await updateStorage(); await recoverInterrupted(); await render(); }
  catch (error) { view.innerHTML = `<div class="callout danger"><strong>Archivio locale non disponibile.</strong><br>${esc(error.message)}</div>`; }
  document.addEventListener("click", onClick); document.addEventListener("submit", onSubmit);
  navigator.serviceWorker?.register("sw.js").catch(() => {});
}

async function updateStorage() {
  if (!navigator.storage?.estimate) { storageStatus.textContent = "Archivio locale nel browser"; return; }
  const { usage = 0, quota = 0 } = await navigator.storage.estimate();
  storageStatus.textContent = `Archivio locale: ${(usage / 1024 / 1024).toFixed(1)} MB${quota ? ` di ${(quota / 1024 / 1024).toFixed(0)} MB` : ""}`;
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
function setView(name) { state.view = name; document.querySelectorAll(".nav").forEach((button) => button.classList.toggle("active", button.dataset.view === name)); render(); }

async function render() {
  if (!state.store) return;
  if (state.view === "home") return renderHome();
  if (state.view === "capture") return renderCapture();
  if (state.view === "search") return renderSearch();
  return renderVerification();
}

async function renderHome() {
  const sessions = (await state.store.all("sessions")).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  if (!sessions.length) { view.innerHTML = document.querySelector("#empty-template").innerHTML; return; }
  view.innerHTML = `<header><div><h1>Sessioni</h1><p class="muted">Episodi di lavoro locali, ordinati dall’ultimo aggiornamento.</p></div><button data-action="new-session">Nuova sessione</button></header><div class="session-list">${sessions.map((session) => `<article class="session-row" data-action="open-session" data-id="${session.id}"><div class="grow"><strong>${esc(session.title)}</strong><p class="small muted">${localDate(session.updatedAt)} · ${session.timezone}</p></div><span class="status ${session.state === "conclusa" ? "ok" : "warn"}">${esc(session.state)}</span></article>`).join("")}</div>`;
}

async function selectedSession() { return state.selectedId ? state.store.get("sessions", state.selectedId) : null; }
async function renderCapture() {
  const session = await selectedSession();
  if (!session) { view.innerHTML = `<div class="empty"><h2>Scegli una sessione</h2><p>La cattura appartiene sempre a una sessione nominabile.</p><button data-action="new-session">Crea sessione</button></div>`; return; }
  const recordings = await state.store.bySession("recordings", session.id), gaps = await state.store.bySession("gaps", session.id), notes = await state.store.bySession("notes", session.id), events = await state.store.bySession("events", session.id);
  const allChunks = (await state.store.all("chunks")).filter((chunk) => chunk.sessionId === session.id).sort((a, b) => a.startMs - b.startMs);
  const active = state.recording?.sessionId === session.id;
  const hasDisplayAudio = !!state.display?.getAudioTracks().length;
  const displaySurface = state.displayInfo?.surface || "non selezionato";
  const completeReady = captureIsLive({ displaySurface, displayTracks: state.display?.getTracks().map((track) => track.readyState) || [], microphoneTracks: state.mic?.getTracks().map((track) => track.readyState) || [], systemTest: state.tests.system, microphoneTest: state.tests.mic });
  const items = [...recordings.map((r) => ({ type: "Registrazione", at: r.offsetStartMs, text: `${r.mode} · ${r.status}${r.cause ? ` (${r.cause})` : ""}`, gap: r.status === "interrotta" })), ...gaps.map((g) => ({ type: "Lacuna", at: g.startMs, text: g.cause, gap: true })), ...events.map((e) => ({ type: "Evento", at: e.startMs ?? 0, text: e.text })), ...notes.map((n) => ({ type: "Nota", at: n.startMs ?? 0, text: n.text }))].sort((a, b) => a.at - b.at);
  const chunkRows = allChunks.map((chunk) => { const saved = hasStoredBlob(chunk), focus = state.jumpOffset != null && chunk.startMs <= state.jumpOffset && chunk.endMs >= state.jumpOffset; return `<div class="split ${focus ? "focus" : ""}"><div><span class="status ${saved ? "ok" : "fail"}">${saved ? "salvato" : "media mancante"}</span> <strong>${esc(chunk.stream)}</strong> <span class="small muted">${formatTime(chunk.startMs)}–${formatTime(chunk.endMs)} · ${(chunk.bytes / 1024 / 1024).toFixed(2)} MB</span></div><button class="secondary compact" data-action="play-block" data-id="${chunk.id}" ${saved ? "" : "disabled"}>Apri flusso</button></div>`; }).join("");
  view.innerHTML = `<header><div><h1>${esc(session.title)}</h1><p class="muted">${esc(session.state)} · inizio ${localDate(session.startedAt)}</p></div><div class="actions"><button class="secondary compact" data-action="rename-session">Rinomina</button><button class="secondary compact" data-action="export-session">Esporta</button><button class="secondary compact" data-action="delete-session">Rimuovi</button></div></header>
  ${session.attestation ? `<div class="callout">Attestazione resa il ${localDate(session.attestation.at)}. Non certifica policy o consenso di altre persone.</div>` : `<div class="callout warn"><strong>Attestazione richiesta.</strong> Prima di una cattura, dichiara di aver verificato gli obblighi applicabili.</div>`}
  <div class="grid"><section class="card"><h2>Preflight dei flussi</h2><p class="muted">Scegli il monitor e l’audio del computer in Chrome; il microfono è richiesto separatamente.</p>
  ${streamRow("Monitor + audio computer", state.display, state.displayInfo ? `${displaySurface}; audio ${hasDisplayAudio ? "presente" : "assente"}` : "non richiesto", "request-display", active)}
  ${streamRow("Microfono", state.mic, streamState(state.mic), "request-mic", active)}
  <div class="actions"><button class="secondary compact" data-action="sample-system" ${!state.display || !hasDisplayAudio || active ? "disabled" : ""}>Prova audio computer</button><button class="secondary compact" data-action="sample-mic" ${!state.mic || active ? "disabled" : ""}>Prova microfono</button></div>
  ${testRow("Sistema", state.tests.system)}${testRow("Microfono", state.tests.mic)}
  <label class="small"><input id="reduced-optin" type="checkbox" ${completeReady ? "" : ""}> Accetto esplicitamente una registrazione <strong>ridotta</strong> se la prova completa non è pronta.</label>
  <div class="actions">${!session.attestation ? `<button data-action="attest">Rendi attestazione</button>` : active ? `<button class="danger" data-action="pause">Pausa / ferma tratto</button><button class="secondary" data-action="conclude">Concludi sessione</button>` : `<button data-action="start-capture" ${session.state === "conclusa" ? "disabled" : ""}>Avvia cattura</button><button class="secondary" data-action="conclude" ${session.state === "conclusa" ? "disabled" : ""}>Concludi sessione</button>`}</div>
  ${active ? `<p class="small"><span class="status ok">in corso</span> Un recorder continuo per flusso salva frammenti progressivi ogni ${CHUNK_MS / 1000}s, senza stop/start fra loro.</p>` : `<p class="small muted">${completeReady ? "Modalità completa pronta." : "La modalità completa richiede monitor, due tracce audio e i due riascolti positivi."}</p>`}</section>
  <section class="card"><h2>Stato e recupero</h2><div id="capture-status">${renderCaptureStatus(recordings)}</div>${recordings.length ? `<div class="session-list">${recordings.sort((a, b) => b.offsetStartMs - a.offsetStartMs).map((recording) => `<div class="split small"><span>${formatTime(recording.offsetStartMs)} · ${esc(recording.mode)} · ${esc(recording.status)}</span><button class="secondary compact" data-action="export-recording" data-id="${recording.id}">Esporta tratto</button></div>`).join("")}</div>` : ""}<p class="small muted">Una chiusura o perdita di flusso crea un’interruzione e non viene mai rappresentata come contenuto acquisito.</p></section>
  <section class="card"><h2>Aggiungi contesto</h2><form data-form="note"><label>Nota libera<textarea name="text" required placeholder="Riflessione o contesto"></textarea></label><button>Salva nota</button></form><form data-form="event"><label>Evento fattuale<textarea name="text" required placeholder="Ad esempio: decisione presa"></textarea></label><button class="secondary">Aggiungi evento</button></form><p class="small muted">Questa build registra esclusivamente video e audio: nessuna trascrizione viene caricata, generata o conservata.</p></section>
  <section class="card wide"><h2>Riproduzione dei flussi salvati</h2>${state.jumpOffset != null ? `<p class="callout">Punto richiesto: ${formatTime(state.jumpOffset)}. Il frammento evidenziato contiene il timestamp cercato.</p>` : ""}${allChunks.length ? `<p class="small muted">Ogni frammento è salvato separatamente, ma viene aperto ricomponendo il flusso del tratto dall'inizio: i frammenti successivi non sono file autonomi.</p><div class="session-list">${chunkRows}</div>` : `<p class="muted">I frammenti media salvati appariranno qui.</p>`}</section>
  <section class="card wide"><h2>Timeline della sessione</h2>${items.length ? `<div class="timeline">${items.map((item) => `<div class="timeline-item ${item.gap ? "gap" : ""}"><span class="chip">${formatTime(item.at)}</span><strong> ${item.type}</strong><p>${esc(item.text)}</p></div>`).join("")}</div>` : `<p class="muted">Ancora nessun tratto, nota o evento.</p>`}</section></div>`;
  refreshMeters();
  if (state.jumpOffset != null) requestAnimationFrame(() => document.querySelector(".focus")?.scrollIntoView({ block: "center", behavior: "smooth" }));
}
function streamRow(label, stream, detail, action, disabled = false) { const live = streamState(stream) === "live"; return `<div class="stream"><i class="dot ${live ? "live" : ""}"></i><div><strong>${label}</strong><div class="small muted">${esc(detail)}</div><div class="meter"><i id="meter-${action}"></i></div></div><button class="secondary compact" data-action="${action}" ${disabled ? "disabled" : ""}>${live ? "Rifai" : "Richiedi"}</button></div>`; }
function testRow(label, test) { return `<p class="small"><span class="status ${test?.passed ? "ok" : test ? "warn" : ""}">${label}: ${test?.passed ? "riascolto confermato" : test?.url ? "campione pronto" : "non verificato"}</span>${test?.url ? ` <button class="secondary compact" data-action="play-test" data-kind="${label === "Sistema" ? "system" : "mic"}">Riascolta</button><button class="compact" data-action="confirm-test" data-kind="${label === "Sistema" ? "system" : "mic"}">Segna riconoscibile</button>` : ""}</p>`; }
function renderCaptureStatus(recordings) { const latest = recordings.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]; return latest ? `<p><span class="status ${latest.status === "interrotta" ? "fail" : latest.status === "terminata" ? "ok" : "warn"}">${esc(latest.status)}</span></p><p class="small">${esc(latest.cause || "Nessuna causa di arresto")}</p>` : `<p class="muted">Nessun tratto salvato.</p>`; }

async function renderSearch() {
  const sessions = (await state.store.all("sessions")).sort((a, b) => a.title.localeCompare(b.title));
  view.innerHTML = `<header><div><h1>Ricerca</h1><p class="muted">Titoli, note ed eventi locali.</p></div></header><section class="card"><form data-form="search"><label>Termine<input name="query" autofocus required placeholder="Cerca nella cronologia"></label><div class="grid"><label>Da<input name="from" type="date"></label><label>A<input name="to" type="date"></label><label>Sessione<select name="sessionId"><option value="">Tutte le sessioni</option>${sessions.map((session) => `<option value="${esc(session.id)}">${esc(session.title)}</option>`).join("")}</select></label></div><button>Cerca</button></form><div id="results" class="session-list"></div></section>`;
}
async function renderVerification() {
  view.innerHTML = `<header><div><h1>Verifica e limiti</h1><p class="muted">Lo sviluppo locale non sostituisce le prove sulla build Chrome/macOS.</p></div></header><section class="card"><h2>Stato onesto della consegna</h2><ul class="checklist"><li><strong>Preflight dei tre flussi:</strong> esito breve positivo solo riferito dall’utente; non osservato dall’agente né misurato sul profilo target.</li><li><strong>Cattura continua:</strong> questa build elimina lo stop/start fra frammenti; continuità, codec e riproduzione restano da misurare sul Mac target.</li><li><strong>Verifiche reali ancora aperte:</strong> prova lunga, quota, crash/revoca/sleep, riproduzione ed export restano da eseguire su Mac e Windows.</li><li><strong>Uso reale con dati aziendali o persone:</strong> bloccato dal gate policy, ancora senza evidenza aziendale.</li></ul><p>Questa build registra solo video e audio; trascrizione e ASR sono fuori dal runtime. Il preflight controlla selezione monitor e presenza delle tracce; un indicatore live non è prova di contenuto.</p><p><a href="docs/verification/capture-preflight-mac-reported-2026-09-22.md" target="_blank">Resoconto storico della prova breve</a> · <a href="docs/verification/acceptance-matrix-2026-09-22.md" target="_blank">Matrice storica dei criteri</a></p></section>`;
}

async function onClick(event) {
  const button = event.target.closest("[data-action],.nav"); if (!button) return;
  if (button.classList.contains("nav")) return setView(button.dataset.view);
  const action = button.dataset.action;
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
  if (form.dataset.form === "delete") { try { const result = await state.store.deleteSession(session.id); dialog.close(); state.selectedId = null; await updateStorage(); setView("home"); showNotice(`Sessione rimossa: ${result.recordings} tratti e ${result.chunks} blocchi rimossi dall’archivio controllato dall’app. Esportazioni o backup esterni non sono controllati dall’app.`, "warn"); } catch (error) { showNotice(`Rimozione non completata (${error.name || "errore"}): la sessione non è dichiarata rimossa. Riprova o conserva l’errore per verifica.`, "danger"); } }
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
async function assertStorage(nextBytes) { const estimate = await navigator.storage?.estimate?.(), admission = storageAdmission(estimate, nextBytes); if (!admission.allowed) throw new DOMException("Quota locale quasi esaurita", "QuotaExceededError"); return admission; }
async function startCapture() {
  const session = await selectedSession(); const complete = captureIsLive({ displaySurface: state.displayInfo?.surface, displayTracks: state.display?.getTracks().map((track) => track.readyState) || [], microphoneTracks: state.mic?.getTracks().map((track) => track.readyState) || [], systemTest: state.tests.system, microphoneTest: state.tests.mic }); const reduced = byId("reduced-optin")?.checked;
  if (!complete && !reduced) return showNotice("Mancano le prove della modalità completa. Se scegli consapevolmente una modalità ridotta, attiva l’opt-in esplicito.", "warn");
  if (!state.display || !state.mic) return showNotice("Sono necessari monitor e microfono; selezionali prima.", "danger");
  let storagePreflight; try { storagePreflight = await assertStorage(0); } catch (error) { return showNotice(`Cattura non avviata: ${error.message}. Libera spazio o esporta i dati confermati.`, "danger"); }
  const recording = { ...nextRecording(session, complete ? "completa verificata" : "ridotta con opt-in"), storagePreflight: { ...storagePreflight, checkedAt: isoNow() } }; state.recording = recording; state.capturing = true; await state.store.put("recordings", recording); state.segmenters = [new Segmenter("display", state.display, recording, session), new Segmenter("microfono", state.mic, recording, session)]; state.segmenters.forEach((segmenter) => segmenter.start()); renderCapture();
}
async function stopCapture(status, cause) { if (!state.recording || state.stopping) return; state.stopping = true; state.capturing = false; const recording = state.recording, session = await state.store.get("sessions", recording.sessionId); await Promise.all(state.segmenters.map((segmenter) => segmenter.finish())); const closed = closeRecording(recording, session, status, cause); await state.store.put("recordings", closed); if (status === "interrotta") { const chunks = await state.store.byRecording("chunks", recording.id), gap = gapAfterSaved(closed, chunks, cause); if (gap) await state.store.put("gaps", { id: id("gap"), ...gap, createdAt: isoNow() }); } session.state = status === "interrotta" ? "interrotta/in attesa di scelta" : "aperta"; session.updatedAt = isoNow(); await state.store.put("sessions", session); state.recording = null; state.segmenters = []; stopStream(state.display); stopStream(state.mic); state.display = state.mic = null; state.displayInfo = null; state.tests = { system: null, mic: null }; state.stopping = false; await updateStorage(); renderCapture(); }
async function failCapture(cause) { if (state.recording) await stopCapture("interrotta", cause); else showNotice(cause, "danger"); }
async function concludeSession() { const session = await selectedSession(); if (state.recording) await stopCapture("terminata", "sessione conclusa"); const latest = await selectedSession(); latest.state = "conclusa"; latest.endedAt = isoNow(); latest.updatedAt = isoNow(); await state.store.put("sessions", latest); renderCapture(); }

async function runSearch(data) { const [sessions, notes, events] = await Promise.all([state.store.all("sessions"), state.store.all("notes"), state.store.all("events")]); const from = data.get("from") ? new Date(data.get("from")).getTime() : 0, to = data.get("to") ? new Date(`${data.get("to")}T23:59:59`).getTime() : Infinity, sessionId = data.get("sessionId"); const visible = sessions.filter((session) => { const time = new Date(session.startedAt).getTime(); return time >= from && time <= to && (!sessionId || session.id === sessionId); }); const hits = searchDocuments(data.get("query"), { sessions: visible, notes, events }).filter((hit) => visible.some((session) => session.id === hit.sessionId)); const target = byId("results"); target.innerHTML = hits.length ? hits.map((hit) => `<article class="result"><span class="chip">${esc(hit.kind)}</span><span class="small muted">${esc(hit.textStatus || "")}</span><p>${esc(hit.text)}</p><button class="secondary compact" data-action="open-session" data-id="${hit.sessionId}" data-offset="${hit.offsetMs ?? ""}">${hit.offsetMs != null ? `Apri a ${formatTime(hit.offsetMs)}` : "Apri sessione"}</button></article>`).join("") : `<p class="muted">Nessun risultato nei documenti selezionati.</p>`; }
async function exportSession() { return exportScope(); }
async function exportScope(recordingId = null) { const session = await selectedSession(), stem = `${safeFileName(session.title)}${recordingId ? `-${recordingId.slice(-6)}` : ""}`, suggested = `${stem}-export.zip`; const [allRecordings, chunks, notes, events, gaps] = await Promise.all([state.store.bySession("recordings", session.id), state.store.all("chunks"), state.store.bySession("notes", session.id), state.store.bySession("events", session.id), state.store.bySession("gaps", session.id)]); const recordings = recordingId ? allRecordings.filter((item) => item.id === recordingId) : allRecordings; if (recordingId && recordings.length !== 1) return showNotice("Export del tratto non disponibile: il tratto non è più presente localmente.", "danger"); const scope = recordingId ? recordingExportScope(recordings[0], sessionOffset(session.startedAt)) : null, intervalStart = scope?.startMs ?? -Infinity, intervalEnd = scope?.endMs ?? Infinity, inScope = (item) => !recordingId || overlapsScope(item, intervalStart, intervalEnd); const allRelevant = chunks.filter((chunk) => chunk.sessionId === session.id && (!recordingId || chunk.recordingId === recordingId)).sort((a, b) => a.startMs - b.startMs), mediaGroups = exportMediaGroups(allRelevant), media = mediaGroups.filter((group) => group.blob), fileByChunkId = new Map(media.flatMap((group) => group.chunks.map((chunk) => [chunk.id, group.file]))), relevantGaps = gaps.filter(inScope), scopedNotes = notes.filter(inScope), scopedEvents = events.filter(inScope), streams = Object.groupBy(allRelevant, (chunk) => chunk.stream), savedBlocks = allRelevant.filter(hasStoredBlob); const manifest = { schemaVersion: 4, exportedAt: isoNow(), scope: { kind: recordingId ? "singolo tratto" : "sessione integrale", sessionId: session.id, parentSession: recordingId ? { id: session.id, title: session.title } : null, recordingId, interval: scope }, session, recordings, streams: Object.fromEntries(Object.entries(streams).map(([stream, blocks]) => [stream, { savedBlocks: blocks.filter(hasStoredBlob).length, mediaFiles: mediaGroups.filter((group) => group.stream === stream).map((group) => ({ recordingId: group.recordingId, file: group.blob ? group.file : null, startsWithRecorderHeader: group.startsWithHeader, continuous: group.continuous, includedBlockIds: group.chunks.map((chunk) => chunk.id), savedButNotIncludedBlockIds: group.skippedChunks.map((chunk) => chunk.id) })) }])), media: mediaGroups.map((group) => ({ recordingId: group.recordingId, stream: group.stream, format: group.format, file: group.blob ? group.file : null, startsWithRecorderHeader: group.startsWithHeader, continuous: group.continuous, includedBlockIds: group.chunks.map((chunk) => chunk.id), savedButNotIncludedBlockIds: group.skippedChunks.map((chunk) => chunk.id) })), notes: scopedNotes, events: scopedEvents, gaps: relevantGaps, chunks: allRelevant.map(({ blob, status, verifiedAt, persistedAt, ...metadata }) => ({ ...metadata, persistence: hasStoredBlob({ blob }) ? "salvato" : "media mancante", persistedAt: persistedAt || verifiedAt || null, file: fileByChunkId.get(metadata.id) || null })), notices: ["Questo export contiene esclusivamente media e metadati locali; nessuna trascrizione è generata o inclusa.", "Ogni file media riapribile ricompone, in ordine, i frammenti di un solo recorder e flusso. I frammenti successivi non sono dichiarati file autonomi.", ...(mediaGroups.some((group) => group.skippedChunks.length) ? ["I frammenti salvati senza header iniziale o dopo una discontinuità restano descritti nel manifest ma non sono esportati come file riapribile."] : [])] }; const entries = [{ name: "manifest.json", data: JSON.stringify(manifest, null, 2) }, ...media.map((group) => ({ name: group.file, data: group.blob }))], size = media.reduce((total, group) => total + group.blob.size, 0); const picker = window.showSaveFilePicker?.({ suggestedName: suggested, types: [{ description: "Archivio Diario", accept: { "application/zip": [".zip"] } }] }); let writable = null; if (picker) { try { writable = await (await picker).createWritable(); } catch (error) { if (error.name === "AbortError") return showNotice("Export annullato: nessun file creato."); showNotice(`Destinazione streaming non disponibile (${error.name}); preparo un archivio in memoria.`, "warn"); } } try { if (writable) await streamZip(entries, writable); else { if (size > 300 * 1024 * 1024) throw new Error("Archivio oltre 300 MB: usa Chrome con il salvataggio streaming disponibile e scegli una destinazione locale."); download(await createZip(entries), suggested); } showNotice(media.length ? `Export concluso: ZIP con manifest e ${media.length} flussi ricomposti da ${savedBlocks.length} frammenti salvati. Riaprilo sul target per la prova richiesta.` : "Export concluso con il manifest: non c'è una sequenza salvata che inizi dall'header del recorder, quindi nessun file media viene dichiarato riapribile.", "warn"); } catch (error) { try { await writable?.abort(); } catch {} showNotice(`Export non concluso: ${error.message}. I dati locali restano disponibili.`, "danger"); } }
async function playBlock(chunkId) { const chunk = await state.store.get("chunks", chunkId); if (!chunk || !hasStoredBlob(chunk)) return showNotice("Il media di questo frammento non è presente localmente.", "danger"); const groups = exportMediaGroups(await state.store.byRecording("chunks", chunk.recordingId)), group = groups.find((candidate) => candidate.chunks.some((item) => item.id === chunk.id)); if (!group?.blob) return showNotice("Questo frammento è salvato, ma manca l'header iniziale o una sequenza continua per ricomporre un file apribile. L'export lo dichiara nel manifest senza fingere una riproduzione.", "warn"); const url = URL.createObjectURL(group.blob), tag = chunk.stream === "display" ? "video" : "audio", offset = state.jumpOffset == null ? 0 : Math.max(0, (state.jumpOffset - group.chunks[0].startMs) / 1000); dialog.innerHTML = `<div class="dialog-body"><h2>Flusso ricomposto ${esc(chunk.stream)} · ${formatTime(group.chunks[0].startMs)}</h2><${tag} id="playback-media" controls src="${url}"></${tag}><p class="small">${group.chunks.length} frammenti salvati sono ricomposti in un solo flusso. ${offset ? `Avvio richiesto a ${formatTime(state.jumpOffset)}.` : ""} Il riascolto non colma intervalli mancanti.</p><button class="secondary" onclick="this.closest('dialog').close()">Chiudi</button></div>`; const media = dialog.querySelector("#playback-media"); media.addEventListener("loadedmetadata", () => { if (Number.isFinite(media.duration)) media.currentTime = Math.min(offset, Math.max(0, media.duration - .05)); media.play().catch(() => {}); }, { once: true }); dialog.addEventListener("close", () => URL.revokeObjectURL(url), { once: true }); dialog.showModal(); }
function download(blob, name) { const url = URL.createObjectURL(blob), link = document.createElement("a"); link.href = url; link.download = name; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 10_000); }
async function confirmDelete() { const session = await selectedSession(); dialog.innerHTML = `<div class="dialog-body"><h2>Rimuovere “${esc(session.title)}”?</h2><p>Verranno rimossi sessione, tratti, blocchi, note, eventi e lacune controllati dall’app in questo browser. Gli export e i backup esterni non vengono trovati o eliminati.</p><form data-form="delete"><div class="actions"><button class="danger">Rimuovi dati locali</button><button type="button" class="secondary" onclick="this.closest('dialog').close()">Annulla</button></div></form></div>`; dialog.showModal(); }

init();
