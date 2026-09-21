/*
 * Preflight only. Media streams and five-second samples stay in memory in this
 * tab; no request other than browser media APIs is made by this page.
 */
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const controls = {
    display: $("request-display"),
    microphone: $("request-microphone"),
    stop: $("stop-all"),
    sampleSystem: $("sample-system"),
    sampleMicrophone: $("sample-microphone"),
  };
  const state = {
    displayStream: null,
    microphoneStream: null,
    analysers: new Map(),
    audioContexts: new Set(),
    samples: { system: null, microphone: null },
    activeRecorders: new Set(),
    discardedRecorders: new Set(),
    frame: null,
  };

  const now = () => new Date().toLocaleTimeString();
  function log(message, cssClass) {
    const line = document.createElement("div");
    if (cssClass) line.className = cssClass;
    line.textContent = `[${now()}] ${message}`;
    $("events").prepend(line);
  }

  function describeError(error) {
    const name = error && error.name ? error.name : "Errore sconosciuto";
    const details = {
      NotAllowedError: "Richiesta negata, annullata o bloccata da permesso/policy. Non aggirare il blocco: annota il messaggio e lo stato della policy pertinente.",
      NotFoundError: "Non è disponibile una sorgente compatibile (schermo, audio o microfono).",
      NotReadableError: "La sorgente esiste ma non può essere letta in questo momento; può essere occupata o bloccata dal sistema.",
      AbortError: "La richiesta o la sorgente è stata interrotta dal browser o dal sistema.",
      InvalidStateError: "La richiesta non aveva un gesto utente valido oppure la pagina non era attiva/in primo piano.",
      SecurityError: "Il browser ha bloccato la cattura per motivi di sicurezza o policy.",
      TypeError: "Contesto o vincoli non accettati dal browser; verifica che l'origine sia sicura e che Chrome sia aggiornato.",
    };
    return `${name}: ${details[name] || (error && error.message) || "Nessun dettaglio fornito dal browser."}`;
  }

  function tracksFor(stream, kind) {
    return stream ? stream.getTracks().filter((track) => !kind || track.kind === kind) : [];
  }

  function renderDisplayDetails() {
    const stream = state.displayStream;
    const video = tracksFor(stream, "video")[0];
    const audio = tracksFor(stream, "audio");
    const details = $("display-details");
    details.replaceChildren();
    const values = [
      ["Superficie", video ? (video.getSettings().displaySurface || "non esposta dal browser") : "nessuna traccia video"],
      ["Video", video ? `${video.readyState} · ${video.enabled ? "abilitata" : "disabilitata"}` : "assente"],
      ["Audio display", audio.length ? audio.map((track) => `${track.readyState} · ${track.enabled ? "abilitata" : "disabilitata"}`).join(", ") : "assente"],
      ["Tracce totali", stream ? String(stream.getTracks().length) : "0"],
    ];
    for (const [label, value] of values) {
      const term = document.createElement("dt");
      const description = document.createElement("dd");
      term.textContent = label;
      description.textContent = value;
      details.append(term, description);
    }
  }

  function renderTrackStatuses() {
    const systemTrack = tracksFor(state.displayStream, "audio")[0];
    const micTrack = tracksFor(state.microphoneStream, "audio")[0];
    $("system-track-status").textContent = systemTrack ? `Traccia ${systemTrack.readyState}; ${systemTrack.enabled ? "abilitata" : "disabilitata"}` : "Traccia display assente";
    $("microphone-track-status").textContent = micTrack ? `Traccia ${micTrack.readyState}; ${micTrack.enabled ? "abilitata" : "disabilitata"}` : "Traccia microfono assente";
    controls.sampleSystem.disabled = !systemTrack || systemTrack.readyState !== "live";
    controls.sampleMicrophone.disabled = !micTrack || micTrack.readyState !== "live";
    controls.stop.disabled = !state.displayStream && !state.microphoneStream;
  }

  function attachEndObserver(track, label) {
    track.addEventListener("ended", () => {
      log(`${label}: traccia terminata dal browser o dal sistema. Pulizia dei flussi rimasti.`, "error");
      stopAll("terminazione di una traccia richiesta");
    }, { once: true });
  }

  async function attachMeter(name, track) {
    if (!track) return;
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextCtor) {
      log(`${name}: Web Audio non disponibile; non posso mostrare un livello locale.`, "error");
      return;
    }
    const context = new AudioContextCtor();
    const analyser = context.createAnalyser();
    analyser.fftSize = 1024;
    // Each analyser has its own one-track stream and deliberately no destination.
    context.createMediaStreamSource(new MediaStream([track])).connect(analyser);
    await context.resume();
    state.audioContexts.add(context);
    state.analysers.set(name, { analyser, data: new Uint8Array(analyser.fftSize) });
  }

  function updateMeters() {
    for (const [name, meter] of state.analysers.entries()) {
      meter.analyser.getByteTimeDomainData(meter.data);
      let total = 0;
      for (const value of meter.data) {
        const sample = (value - 128) / 128;
        total += sample * sample;
      }
      const rms = Math.sqrt(total / meter.data.length);
      const decibels = rms ? 20 * Math.log10(rms) : -Infinity;
      const percent = Math.max(0, Math.min(100, ((decibels + 60) / 60) * 100));
      $(`${name}-meter`).style.width = `${percent}%`;
      $(`${name}-level`).textContent = Number.isFinite(decibels) ? `${decibels.toFixed(1)} dBFS (livello, non prova di contenuto)` : "Silenzio rilevato";
    }
    state.frame = requestAnimationFrame(updateMeters);
  }

  function chooseRecorder(stream) {
    const preferred = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"];
    const mimeType = preferred.find((type) => window.MediaRecorder && MediaRecorder.isTypeSupported(type));
    return mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
  }

  function revokeSample(name) {
    const sample = state.samples[name];
    if (sample) URL.revokeObjectURL(sample.url);
    state.samples[name] = null;
    $(`${name}-sample`).removeAttribute("src");
    $(`${name}-sample`).load();
  }

  function makeSample(name, track) {
    if (!track || track.readyState !== "live") {
      log(`${name}: non è disponibile una traccia live per la prova.`, "error");
      return;
    }
    if (!window.MediaRecorder) {
      log(`${name}: MediaRecorder non è disponibile in questo browser.`, "error");
      return;
    }
    revokeSample(name);
    const isolatedStream = new MediaStream([track]);
    let recorder;
    try {
      recorder = chooseRecorder(isolatedStream);
    } catch (error) {
      log(`${name}: ${describeError(error)}`, "error");
      return;
    }
    const chunks = [];
    state.activeRecorders.add(recorder);
    recorder.addEventListener("dataavailable", (event) => {
      if (event.data.size) chunks.push(event.data);
    });
    recorder.addEventListener("stop", () => {
      state.activeRecorders.delete(recorder);
      if (state.discardedRecorders.delete(recorder)) return;
      if (!chunks.length) {
        log(`${name}: il browser non ha prodotto un campione riascoltabile.`, "error");
        return;
      }
      const blob = new Blob(chunks, { type: recorder.mimeType || chunks[0].type });
      const url = URL.createObjectURL(blob);
      state.samples[name] = { url };
      const player = $(`${name}-sample`);
      player.src = url;
      log(`${name}: campione pronto solo in memoria. Riascoltalo e annota se il contenuto è riconoscibile.`, "ok");
    }, { once: true });
    recorder.start();
    log(`${name}: registrazione separata di 5 secondi avviata.`, "ok");
    window.setTimeout(() => {
      if (recorder.state !== "inactive") recorder.stop();
    }, 5000);
  }

  async function requestDisplay() {
    if (!window.isSecureContext) {
      log("Contesto non sicuro: non avvio la richiesta. Apri la pagina da localhost o da un'origine HTTPS approvata.", "error");
      return;
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
      log("getDisplayMedia non è disponibile in questo browser/origine.", "error");
      return;
    }
    if (state.displayStream) {
      log("Una richiesta display è già attiva. Ferma e pulisci prima di richiederne un'altra.", "error");
      return;
    }
    try {
      // The browser/user chooses the surface. systemAudio is only a request hint.
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true, systemAudio: "include" });
      state.displayStream = stream;
      $("display-preview").srcObject = stream;
      for (const track of stream.getTracks()) attachEndObserver(track, `Display ${track.kind}`);
      await attachMeter("system", tracksFor(stream, "audio")[0]);
      renderDisplayDetails();
      renderTrackStatuses();
      const videoTrack = tracksFor(stream, "video")[0];
      const displaySurface = videoTrack ? videoTrack.getSettings().displaySurface : undefined;
      if (displaySurface !== "monitor") {
        log("La selezione non risulta un monitor. Questo non supera la prova completa: ferma e riprova scegliendo Schermo intero/monitor.", "error");
      }
      if (!tracksFor(stream, "audio").length) {
        log("Chrome ha restituito video senza audio display. Non dedurre che l'audio di sistema sia disponibile.", "error");
      }
      log("Display acquisito: controlla superficie, tracce e livello. Una traccia live non prova da sola il contenuto.", "ok");
      if (!state.frame) updateMeters();
    } catch (error) {
      log(`Display: ${describeError(error)}`, "error");
    }
  }

  async function requestMicrophone() {
    if (!window.isSecureContext) {
      log("Contesto non sicuro: non avvio la richiesta microfono.", "error");
      return;
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      log("getUserMedia non è disponibile in questo browser/origine.", "error");
      return;
    }
    if (state.microphoneStream) {
      log("Una richiesta microfono è già attiva. Ferma e pulisci prima di richiederne un'altra.", "error");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      state.microphoneStream = stream;
      for (const track of stream.getTracks()) attachEndObserver(track, `Microfono ${track.kind}`);
      await attachMeter("microphone", tracksFor(stream, "audio")[0]);
      renderTrackStatuses();
      log("Microfono acquisito separatamente: esegui la prova vocale soltanto dopo aver fermato il suono dell'altra app.", "ok");
      if (!state.frame) updateMeters();
    } catch (error) {
      log(`Microfono: ${describeError(error)}`, "error");
    }
  }

  function closeAnalysers() {
    for (const context of state.audioContexts) context.close().catch(() => {});
    state.audioContexts.clear();
    state.analysers.clear();
    if (state.frame) cancelAnimationFrame(state.frame);
    state.frame = null;
    for (const name of ["system", "microphone"]) {
      $(`${name}-meter`).style.width = "0";
      $(`${name}-level`).textContent = "Nessun segnale";
    }
  }

  function stopTracks(stream) {
    if (stream) stream.getTracks().forEach((track) => track.stop());
  }

  function stopAll(reason) {
    for (const recorder of state.activeRecorders) {
      if (recorder.state !== "inactive") {
        state.discardedRecorders.add(recorder);
        recorder.stop();
      }
    }
    state.activeRecorders.clear();
    stopTracks(state.displayStream);
    stopTracks(state.microphoneStream);
    state.displayStream = null;
    state.microphoneStream = null;
    $("display-preview").srcObject = null;
    closeAnalysers();
    revokeSample("system");
    revokeSample("microphone");
    renderDisplayDetails();
    renderTrackStatuses();
    log(`Flussi e campioni locali eliminati (${reason || "stop manuale"}).`, "ok");
  }

  function initialise() {
    const secureMessage = window.isSecureContext
      ? "Contesto sicuro rilevato. Le richieste restano soggette a Chrome, macOS e policy aziendali."
      : "Contesto non sicuro: i comandi sono bloccati. Usa localhost o un'origine HTTPS aziendalmente approvata.";
    $("secure-context").textContent = secureMessage;
    if (!window.isSecureContext) {
      controls.display.disabled = true;
      controls.microphone.disabled = true;
    }
    renderDisplayDetails();
    renderTrackStatuses();
    log(`Pagina pronta. secure context: ${window.isSecureContext ? "sì" : "no"}; getDisplayMedia: ${!!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia)}; getUserMedia: ${!!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)}.`);
  }

  controls.display.addEventListener("click", requestDisplay);
  controls.microphone.addEventListener("click", requestMicrophone);
  controls.stop.addEventListener("click", () => stopAll("stop manuale"));
  controls.sampleSystem.addEventListener("click", () => makeSample("system", tracksFor(state.displayStream, "audio")[0]));
  controls.sampleMicrophone.addEventListener("click", () => makeSample("microphone", tracksFor(state.microphoneStream, "audio")[0]));
  window.addEventListener("beforeunload", () => stopAll("chiusura pagina"));
  initialise();
})();
