# Verifica build di sviluppo — 2026-09-22

## Ambiente osservato

La build statica è stata servita localmente su Windows con Python 3.12.14 e aperta nel browser integrato Codex su `http://127.0.0.1:4173/`. Node 20.20.0 ha eseguito i test puri. Questo **non** è Chrome/macOS aziendale e non è una prova AC.

## Risultati osservati

| Caso | Evidenza | Esito |
| --- | --- | --- |
| Dominio e archivio | `npm test`: 11/11 superati; timeline, lacune, ricerca, fonti ASR, preflight, ZIP classico e ZIP64 streaming | Superato in Node |
| Sintassi/moduli | `node --check` sui moduli `src/app.js`, `src/core.js` e `src/zip.js` | Superato |
| UI locale | Creata sessione “Verifica locale”; attestazione registrata | Osservato |
| Timeline e ricerca | Nota locale salvata e visibile a `00:00:14`; ricerca “verifica” ha restituito titolo e nota con salto | Osservato |
| UI sessione | La rinomina “Verifica locale” → “Verifica UI” è stata salvata e riflessa nella vista | Osservato |
| ASR: download esplicito | Pulsante ASR ha caricato Transformers.js 3.8.1 e `Xenova/whisper-tiny`; UI ha mostrato `Motore: pronto` e “nessun audio è stato inviato”; la stima archivio è passata a 104.9 MB | Osservato in browser integrato Windows |
| ASR: assenza media | “Trascrivi blocchi confermati” senza blocchi ha rifiutato l’avvio con “Non ci sono blocchi microfono confermati da trascrivere” | Osservato |
| Archivio export | Test Node costruisce ZIP con `manifest.json`, `trascrizione.txt` e media sintetico; la build usa streaming verso una destinazione scelta in Chrome, con fallback in memoria limitato | Superato sinteticamente |
| Permessi/cattura | Nessuna richiesta di schermo, audio o microfono è stata avviata | Non eseguito intenzionalmente |
| Export/rimozione | UI presente, ma nessun download o rimozione è stato eseguito sul dispositivo di prova | Non eseguito |
| ZIP64 | Un archivio ZIP64 piccolo generato dal writer streaming è stato aperto e letto con `zipfile` Python; test di soglia 4 GiB/65.535 entry senza allocazione multi-GiB | Superato localmente; export lungo su Mac non eseguito |
| Pacchetto Mac | Lo ZIP di trasferimento contiene 23 file con percorsi `docs/` e `.scratch/` conservati; contenuti confrontati byte per byte con la build del checkout | Superato localmente |

Il dispositivo di destinazione, secondo l'utente, è un MacBook Pro 14 pollici 2024 con M4 Max, 64 GB di memoria unificata e macOS Tahoe 26.6.2. Versione e configurazione non sono state osservate dall'agente; versione Chrome e spazio libero non sono ancora stati riportati. La memoria disponibile non dimostra velocità o qualità ASR.

## Risultati che non si possono inferire

Non sono stati eseguiti AC1–AC10, né test di due ore, MediaRecorder sul Mac, recupero dopo crash/revoca/sleep, quota, riproducibilità di blocchi reali, qualità/timestamp ASR su italiano, decodifica dell’audio display in ASR, cache offline con rete staccata o riapertura di export. Per tali prove usare la matrice della specifica sul Mac/profilo Chrome di destinazione e registrare versioni, procedura, misure, lacune ed esito.
