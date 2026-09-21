# Verifica build di sviluppo — 2026-09-22

## Ambiente osservato

La build statica è stata servita localmente su Windows con Python 3.12.14 e aperta nel browser integrato Codex su `http://127.0.0.1:4173/`. Node 20.20.0 ha eseguito i test puri. Questo **non** è Chrome/macOS aziendale e non è una prova AC.

## Risultati osservati

| Caso | Evidenza | Esito |
| --- | --- | --- |
| Dominio | `npm test`: 4/4 superati; offset, lacuna, ricerca e helper export | Superato in Node |
| Sintassi/moduli | `node --check src/app.js` e `node --check src/core.js` | Superato |
| UI locale | Creata sessione “Verifica locale”; attestazione registrata | Osservato |
| Timeline e ricerca | Nota locale salvata e visibile a `00:00:14`; ricerca “verifica” ha restituito titolo e nota con salto | Osservato |
| UI sessione | La rinomina “Verifica locale” → “Verifica UI” è stata salvata e riflessa nella vista | Osservato |
| ASR: download esplicito | Pulsante ASR ha caricato Transformers.js 3.8.1 e `Xenova/whisper-tiny`; UI ha mostrato `Motore: pronto` e “nessun audio è stato inviato”; la stima archivio è passata a 104.9 MB | Osservato in browser integrato Windows |
| ASR: assenza media | “Trascrivi blocchi confermati” senza blocchi ha rifiutato l’avvio con “Non ci sono blocchi microfono confermati da trascrivere” | Osservato |
| Archivio export | Test Node costruisce ZIP con `manifest.json`, `trascrizione.txt` e media sintetico; la build usa streaming verso una destinazione scelta in Chrome, con fallback in memoria limitato | Superato sinteticamente |
| Permessi/cattura | Nessuna richiesta di schermo, audio o microfono è stata avviata | Non eseguito intenzionalmente |
| Export/rimozione | UI presente, ma nessun download o rimozione è stato eseguito sul dispositivo di prova | Non eseguito |

## Risultati che non si possono inferire

Non sono stati eseguiti AC1–AC10, né test di due ore, MediaRecorder sul Mac, recupero dopo crash/revoca/sleep, quota, riproducibilità di blocchi reali, qualità/timestamp ASR su italiano, decodifica dell’audio display in ASR, cache offline con rete staccata o riapertura di export. Per tali prove usare la matrice della specifica sul Mac/profilo Chrome di destinazione e registrare versioni, procedura, misure, lacune ed esito.
