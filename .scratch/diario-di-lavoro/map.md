Label: wayfinder:map
Status: open

# Diario di lavoro — mappa Wayfinder

## Destination

Una specifica tecnicamente verificata, pronta per scomposizione e implementazione di una web app «Diario di lavoro» per Chrome su Mac aziendale senza privilegi amministratore. L'obiettivo del progetto, oltre questa mappa, è l'app finita, testata e consegnata.

## Notes

- Le sessioni decisionali trattano un ticket alla volta; le ricerche possono procedere secondo Wayfinder. La presente mappa prepara una specifica e task pronti per revisione.
- Gate esplicito dell'utente (2026-09-21): dopo grilling, decisioni, specifica e preparazione task, il coordinatore si ferma e chiede se procedere all'implementazione. Nessun task Terra High o codice prodotto prima di conferma esplicita. Il controllo ogni due minuti viene disattivato mentre si attende l'approvazione.
- Per charting, grilling, domande, decisioni, pianificazione e definizione task: GPT-5.6 Sol Medium. Solo implementazione finale: GPT-5.6 Terra High.
- Consultare `wayfinder`, `grilling` e `domain-modeling`; aggiornare `CONTEXT.md` solo quando un termine viene definito. Le risposte al grilling sono delegate esplicitamente dall'utente al coordinatore. Questa è un'eccezione concordata alla regola HITL della skill: annotare ogni risposta come scelta delegata, distinta dai fatti verificati. Non fingere che una prova Windows valga per macOS.
- Scelte delegate dal coordinatore il 2026-09-21, non verificate sul Mac: il requisito completo è cattura manuale di schermo intero, audio del computer e microfono; supporto condizionato alle versioni macOS/Chrome documentate e ai permessi concedibili senza amministratore. Un'alternativa solo scheda/microfono deve essere etichettata e non soddisfa il requisito completo. La registrazione ha indicatore visibile e controllo dei flussi; sessioni lunghe richiedono salvataggio incrementale e recupero.
- Scelte delegate dal coordinatore il 2026-09-21: dati e trascrizioni locali per impostazione predefinita; nessun invio automatico esterno, credenziale o spesa presunta. Prima versione: registrazione, recupero affidabile, trascrizione temporizzata, cronologia, ricerca, esportazione video/audio e testo. Riassunti automatici fuori dalla prima versione perché non richiesti esplicitamente dall'utente.
- Verifiche aperte: effettiva disponibilità di audio di sistema da `getDisplayMedia` su Chrome/macOS, versioni minime, permessi, policy aziendali e comportamento reale sul Mac dell'utente. Verificare anche trascrizione locale, limiti di archiviazione browser, recupero dopo interruzioni e prestazioni.
- Fonti primarie preliminari, senza risoluzione del ticket: [Chromium issue 425893161](https://issues.chromium.org/issues/425893161) attesta la separazione del lancio della cattura audio di sistema macOS per Cast e `getDisplayMedia`; il [commit Chromium 6652695](https://chromium-review.googlesource.com/c/chromium/src/+/6652695) dichiara la base macOS 14.2+ e flag separati per Cast e ScreenShare. Nessuna delle due fonti dimostra che la combinazione richiesta sia attiva e funzionante sul Mac specifico. [Guida ufficiale ai progetti locali di Codex](https://learn.chatgpt.com/docs/projects) descrive il collegamento di cartelle a un progetto.
- Repository e tracker sono locali e separati da Karen, HarnessAgents e AI Usage Notch. Non aggiungere servizi remoti o cambiare policy aziendali senza decisione esplicita.

## Decisions so far

- [Verificare cattura completa in Chrome su macOS](issues/01-verificare-cattura-chrome-macos.md): Chrome 142+ e macOS 14.2+ sono la baseline documentale prudente; il flusso completo resta da provare sul Mac aziendale.
- [Verificare trascrizione e persistenza locali nel browser](issues/02-verificare-trascrizione-e-persistenza-locali.md): pipeline candidata Whisper locale, OPFS e IndexedDB; timestamp, prestazioni, durata e recupero restano da misurare sul Mac aziendale.
- [Definire linguaggio e unità di lavoro](issues/03-definire-linguaggio-e-unita-di-lavoro.md): la sessione è l'episodio e l'unità primaria di ricerca/export; registrazioni, flussi, segmenti ed eventi mantengono confini e lacune espliciti.

## Not yet specified

- Scelta dettagliata del flusso di trascrizione locale dopo la verifica di disponibilità, qualità, download del modello e prestazioni sul Mac.
- Dettagli della struttura dati e della ricerca dopo aver definito cosa costituisce una sessione, una registrazione e una trascrizione.
- Requisiti di privacy e retention legati alle regole aziendali e ai partecipanti alle call: servono fatti e vincoli dell'ambiente prima di formulare una decisione completa.
- Piano di test e consegna dell'app in base alla combinazione macOS/Chrome realmente disponibile e alla modalità di distribuzione consentita.

## Out of scope

- Riassunti automatici nella prima versione: non richiesti esplicitamente; rivalutabili in un futuro sforzo.
- Installazione di driver/helper, modifiche alle policy aziendali e cattura occulta: incompatibili con i vincoli dichiarati.
- Implementazione dell'app nella presente mappa: avverrà in sessioni dedicate dopo le decisioni.
