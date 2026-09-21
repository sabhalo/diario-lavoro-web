Label: wayfinder:map
Status: open

# Diario di lavoro — mappa Wayfinder

## Destination

Una specifica tecnicamente verificata, pronta per scomposizione e implementazione di una web app «Diario di lavoro» per Chrome su Mac aziendale senza privilegi amministratore. L'obiettivo del progetto, oltre questa mappa, è l'app finita, testata e consegnata.

## Notes

- Le sessioni decisionali trattano un ticket alla volta; le ricerche possono procedere secondo Wayfinder. La presente mappa prepara una specifica e task pronti per revisione.
- Gate esplicito dell'utente (2026-09-21): dopo grilling, decisioni, specifica e preparazione task, il coordinatore si ferma e chiede se procedere all'implementazione. Il 2026-09-22 l'utente ha approvato l'implementazione completa dopo la prova Mac preliminare riferita; lo sviluppo non equivale ad autorizzazione aziendale per l'uso reale. Il controllo ricorrente ogni due minuti non viene usato.
- Per charting, grilling, domande, decisioni, pianificazione e definizione task: GPT-5.6 Sol Medium. Solo implementazione finale: GPT-5.6 Terra High.
- Consultare `wayfinder`, `grilling` e `domain-modeling`; aggiornare `CONTEXT.md` solo quando un termine viene definito. Le risposte al grilling sono delegate esplicitamente dall'utente al coordinatore. Questa è un'eccezione concordata alla regola HITL della skill: annotare ogni risposta come scelta delegata, distinta dai fatti verificati. Non fingere che una prova Windows valga per macOS.
- Scelte delegate dal coordinatore il 2026-09-21, non verificate sul Mac: il requisito completo è cattura manuale di schermo intero, audio del computer e microfono; supporto condizionato alle versioni macOS/Chrome documentate e ai permessi concedibili senza amministratore. Un'alternativa solo scheda/microfono deve essere etichettata e non soddisfa il requisito completo. La registrazione ha indicatore visibile e controllo dei flussi; sessioni lunghe richiedono salvataggio incrementale e recupero.
- Scelte delegate dal coordinatore il 2026-09-21: dati e trascrizioni locali per impostazione predefinita; nessun invio automatico esterno, credenziale o spesa presunta. Prima versione: registrazione, recupero affidabile, trascrizione temporizzata, cronologia, ricerca, esportazione video/audio e testo. Riassunti automatici fuori dalla prima versione perché non richiesti esplicitamente dall'utente.
- Verifiche aperte: la prova breve Mac dei tre flussi è positiva **secondo il resoconto dell'utente**, non osservata dall'agente; versioni esatte, dettagli API/permessi e policy non sono stati comunicati. Restano da verificare sulla build finale trascrizione locale, limiti di archiviazione browser, recupero dopo interruzioni, prestazioni, prova di almeno due ore e tutti gli AC. Policy aziendali per l'uso reale non accertate.
- Fonti primarie preliminari, senza risoluzione del ticket: [Chromium issue 425893161](https://issues.chromium.org/issues/425893161) attesta la separazione del lancio della cattura audio di sistema macOS per Cast e `getDisplayMedia`; il [commit Chromium 6652695](https://chromium-review.googlesource.com/c/chromium/src/+/6652695) dichiara la base macOS 14.2+ e flag separati per Cast e ScreenShare. Nessuna delle due fonti dimostra che la combinazione richiesta sia attiva e funzionante sul Mac specifico. [Guida ufficiale ai progetti locali di Codex](https://learn.chatgpt.com/docs/projects) descrive il collegamento di cartelle a un progetto.
- Repository e tracker sono locali e separati da Karen, HarnessAgents e AI Usage Notch. Non aggiungere servizi remoti o cambiare policy aziendali senza decisione esplicita.

## Decisions so far

- [Verificare cattura completa in Chrome su macOS](issues/01-verificare-cattura-chrome-macos.md): Chrome 142+ e macOS 14.2+ sono la baseline documentale prudente; la prova breve sul Mac è positiva secondo l'utente, con versioni reali non comunicate.
- [Verificare il Mac aziendale senza cambiare policy](issues/05-verificare-mac-aziendale.md): fattibilità preliminare dei tre flussi riferita positiva dall'utente il 2026-09-22; test approfonditi della build, versioni e policy ancora mancanti.
- [Verificare trascrizione e persistenza locali nel browser](issues/02-verificare-trascrizione-e-persistenza-locali.md): pipeline candidata Whisper locale, OPFS e IndexedDB; timestamp, prestazioni, durata e recupero restano da misurare sul Mac aziendale.
- [Definire linguaggio e unità di lavoro](issues/03-definire-linguaggio-e-unita-di-lavoro.md): la sessione è l'episodio e l'unità primaria di ricerca/export; registrazioni, flussi, segmenti ed eventi mantengono confini e lacune espliciti.
- [Definire esperienza e criteri di accettazione](issues/04-definire-esperienza-e-criteri-di-accettazione.md): modalità completa verificata con prova dei tre flussi, riduzione solo esplicita, recupero e trascrizione locale; accettazione richiede test reali sul Mac, incluso tratto di almeno due ore.
- [Definire modello dati e ricerca locale](issues/07-definire-modello-dati-e-ricerca.md): identità e timeline esplicite, blocchi recuperabili verificati, lacune, versioni ASR e correzioni, indice per documento sorgente ed export con ambito/provenienza; tecnologia e affidabilità restano da verificare sul Mac.
- [Definire vincoli aziendali di registrazione e conservazione](issues/06-definire-privacy-e-conservazione-aziendale.md): defaults locali e attestazione per sessione; policy, consenso, retention e export richiedono prove aziendali prima dell'uso reale, separate dalla verifica tecnica Mac.

## Not yet specified

- Scelta dettagliata del flusso di trascrizione locale dopo la verifica di disponibilità, qualità, download del modello e prestazioni sul Mac.
- Piano di test e consegna dell'app in base alla combinazione macOS/Chrome realmente disponibile e alla modalità di distribuzione consentita.

## Out of scope

- Riassunti automatici nella prima versione: non richiesti esplicitamente; rivalutabili in un futuro sforzo.
- Installazione di driver/helper, modifiche alle policy aziendali e cattura occulta: incompatibili con i vincoli dichiarati.
- Implementazione dell'app nella presente mappa: avverrà in sessioni dedicate dopo le decisioni.
