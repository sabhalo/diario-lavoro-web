Parent: ../map.md
Type: implementation
Status: implemented; target-device verification pending

# Solo media e cattura continua

## Obiettivo

La build richiesta dall'utente registra solo video e audio. La trascrizione e i suoi flussi non devono più essere caricati, mostrati o eseguiti. La cattura segmentata deve mantenere contenuto e timeline continui tra i file.

## Fatti verificati

- L'attuale `Segmenter` chiama `MediaRecorder.stop()` ogni 10 secondi e avvia un nuovo recorder solo nel callback `onstop` dopo salvataggio e verifica. Questo interrompe l'encoder tra due blocchi e spiega i secondi mancanti osservati.
- La build importa `asr-core.js`, conserva stato ASR, mostra comandi/diagnostica ASR e registra un service worker che mette in cache runtime e fixture della trascrizione.
- Non è stata ancora svolta una cattura reale su Mac M4 Pro in questo ticket; browser, permessi e codec effettivi restano da verificare sul target.

## Decisioni di implementazione

- Sostituire stop/start con un `MediaRecorder` per flusso e registrazione, avviato una sola volta con `timeslice`. I callback `dataavailable` persistono blocchi progressivi senza arrestare il recorder.
- Derivare gli intervalli dai timecode monotoni del recorder, con fallback monotono, così che un ritardo di scrittura non diventi lacuna dichiarata.
- Usare WebM/Opus con bitrate moderati; privilegiare il flusso continuo su micro-ottimizzazioni. La riproducibilità dei singoli frammenti resta da provare sul Mac e non va sovradichiarata.
- Rimuovere interfaccia, import, azioni, cache e test ASR. Dati di trascrizione preesistenti non sono consultati/esportati dalla nuova build.

## Piano e verifica

1. Aggiungere funzioni pure e test per intervalli di `dataavailable` consecutivi, inclusi callback ritardati.
2. Convertire il recorder a timeslice continuo, attendendo i salvataggi in sospeso alla fine del tratto.
3. Eliminare ASR dalla UI e dal runtime/cache, aggiornare ricerca/export a soli titoli, note ed eventi.
4. Eseguire test Node, controllo sintattico e una prova browser sintetica quando possibile. La prova capture continua reale sul Mac resta esplicitamente separata.

## Evidenza di sviluppo

- Test Node: gli intervalli consecutivi `dataavailable` senza stop/start sono contigui anche con callback ritardato; ZIP solo manifest/media e ricerca senza trascrizioni sono coperti.
- Caricamento browser: build media-only aperta su `localhost`, UI ASR assente e console senza errori. La prova di upgrade da un archivio v1 preesistente e la prova di cattura reale sul Mac target restano aperte; quest'ultima richiede una scelta esplicita e sicura delle superfici nel picker di Chrome.
- Verifiche completate: `npm test` (13/13), `node --check src/app.js`, controllo del diff e caricamento browser della build finale dopo il cache-bust. Nessun commit è stato creato per questa modifica.
