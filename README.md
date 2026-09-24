# Diario di lavoro

Web app locale, senza backend, account, analytics o upload automatici. All'avvio richiede una cartella locale scelta dalla persona: sessioni, media, note, eventi, lacune, manifest e journal vivono come file in quella cartella. Nel browser resta soltanto il riferimento alla cartella, non una copia dei dati di lavoro.

Il repository pubblico corrente è [sabhalo/diario-lavoro-web](https://github.com/sabhalo/diario-lavoro-web); il branch principale è `main`. Per avviare la build corrente usare il clone Git descritto sotto, non pacchetti ZIP storici.

## Stato della build

La build registra **video e audio**: monitor con eventuale audio del computer e microfono restano flussi distinti. Include trascrizione locale su richiesta, tramite un modello nel browser oppure un motore ASR separato sullo stesso computer. La trascrizione non parte durante la cattura e non viene inviata a un servizio cloud. Se una registrazione contiene video, al motore viene inviata soltanto la traccia audio estratta.

Per ogni tratto l'app mantiene un `MediaRecorder` vivo per flusso e riceve frammenti progressivi ogni 30 secondi; non riavvia l'encoder fra due frammenti. Gli intervalli sono costruiti dai timecode del recorder con fallback monotono, per evitare lacune introdotte dalla finalizzazione o dalla scrittura di un blocco precedente. Display usa preferibilmente WebM VP8/Opus a 4 Mb/s più 128 kb/s audio; il microfono usa WebM/Opus a 128 kb/s, con fallback alla configurazione supportata dal browser.

Un frammento `MediaRecorder` dopo il primo non è necessariamente un file apribile da solo: **salvato** significa che il suo Blob è stato scritto, chiuso e riaperto nella cartella, non che debba contenere un header autonomo. Per riproduzione ed export l'app ricompone in ordine i frammenti consecutivi dello stesso tratto e flusso, partendo dal frammento iniziale. Le registrazioni legacy con la vecchia etichetta `non verificabile` sono incluse nella migrazione se il Blob esiste. Se manca l'header iniziale o un indice intermedio, il manifest lo dichiara e non presenta il resto come file riapribile.

## Avvio locale e test

Serve una origine sicura: `localhost` in sviluppo oppure HTTPS.

```bash
python3 -m http.server 4173 --bind 127.0.0.1
```

Aprire `http://127.0.0.1:4173/` nel browser. In alternativa, con Docker Desktop o Docker Engine e Compose già disponibili, eseguire `docker compose up --build` e aprire lo stesso indirizzo. Il container serve soltanto file statici su `127.0.0.1:4173`; i dati restano nella cartella scelta in Chrome sul computer host.

Per preparare i moduli di trascrizione nel browser servono Node 20+ e un download iniziale delle dipendenze. La build statica generata è inclusa nel repository; il browser scarica i pesi del modello soltanto dopo il clic su **Prepara modello**:

```bash
npm ci
npm run build:browser-asr
```

Eseguire i test:

```bash
npm test
python -m unittest discover -s local-asr -p 'test_*.py' -v
```

## Trascrizione locale

Nella sezione **Trascrizione locale** scegliere **Nel browser** oppure **Motore locale sul computer**. Per il browser scegliere il livello, cliccare **Prepara modello con download esplicito**, quindi **Trascrivi tratto** o **Trascrivi sessione**. I livelli Rapido e Bilanciato usano Whisper in JavaScript/WebAssembly. Il candidato Qualità massima usa WebGPU e resta disabilitato finché non supera le prove di qualità e compatibilità su Windows e Mac. La dimensione del download e i requisiti di memoria dipendono dal livello.

Per il motore separato seguire le istruzioni in [local-asr/README.md](local-asr/README.md). Richiede Python 3.10+, il programma `whisper-cli` di whisper.cpp e un modello multilingue installati localmente. Inserire nell'app l'**URL completo** dell'endpoint, per esempio `http://127.0.0.1:8765/asr`, con porta e percorso. L'app effettua un controllo del servizio sullo stesso URL prima della trascrizione e invia finestre WAV solo dopo il clic. Il server accetta soltanto connessioni loopback e l'origine browser configurata. LM Studio e Ollama non espongono per questa integrazione il contratto audio richiesto: l'URL libero permette di configurare il servizio ASR dedicato, senza presumere che un endpoint di chat sappia trascrivere.

La vista ordina i segmenti nel tempo e indica **Microfono** o **Audio del computer**. I risultati, la sorgente, il modello e la copertura elaborata sono salvati nella cartella archivio; una run incompleta o fallita resta distinguibile da una completa. Un tratto senza testo non dimostra che l'audio fosse silenzioso. Conservare sempre il media originale per correggere o verificare il testo.

Le stesse opzioni e lo stesso contratto HTTP sono previsti per Windows e macOS. Le prove eseguite e quelle ancora necessarie sono registrate in [docs/verification/local-transcription-matrix.md](docs/verification/local-transcription-matrix.md).

## Avvio sul Mac

Non è un'app eseguibile `.app`: è una web app statica che Chrome deve aprire da `localhost` o HTTPS. Dopo la pubblicazione del branch, sul Mac:

```bash
git clone https://github.com/sabhalo/diario-lavoro-web.git diario-lavoro-web
cd diario-lavoro-web
python3 -m http.server 4173 --bind 127.0.0.1
```

Aprire `http://127.0.0.1:4173/` in Chrome e fermare il server con `Ctrl+C` al termine. Per aggiornare un clone già esistente, passare a `main` con `git switch main` e poi usare `git pull --ff-only`. Servono Git, Python 3 e Chrome già consentiti dall'ambiente; non installare componenti o cambiare policy se mancanti.

Al primo avvio scegliere una cartella locale dedicata e concedere il permesso lettura/scrittura richiesto da Chrome. Se il handle è revocato, l'app rimane bloccata finché non si ricollega una cartella; non esiste fallback in IndexedDB, OPFS o cache browser.

## Esportare una registrazione già salvata sul Mac

1. Aggiornare il clone con `git pull --ff-only`, riavviare il server e ricaricare la pagina in Chrome.
2. Scegliere una cartella dedicata e usare **Migra dati browser** se appare. La migrazione copia e riapre ogni file, è ripetibile dopo un'interruzione e cancella la copia IndexedDB soltanto al termine verificato.
3. Selezionare **Esporta tratto** oppure **Esporta**. Lo ZIP contiene `manifest.json` e un file media ricomposto per ogni sequenza continua di recorder/flusso; monitor e microfono restano separati.
4. Estrarre lo ZIP e aprire il file media nel browser o in un player compatibile. Se il manifest segnala header iniziale o continuità mancanti, quel segmento non viene spacciato per file riproducibile.

Il percorso di export resta da verificare su registrazioni reali nei due sistemi operativi.

Al primo avvio di una cattura Chrome chiede di selezionare il monitor e l'eventuale audio del computer, quindi il microfono separatamente. Scegliere solo contenuti innocui per le prove e concedere permessi del sito/macOS solo se consentiti dalla policy aziendale. Non scegliere automaticamente modalità ridotte né aggirare permessi negati.

## Cosa fa

- crea sessioni, richiede un'attestazione prima della cattura e conserva note, eventi e timeline;
- richiede monitor/audio del computer e microfono in due richieste separate; verifica la superficie `monitor` e propone due campioni da riascoltare separatamente;
- salva frammenti media progressivi senza stop/start periodico del recorder;
- interrompe il tratto alla perdita di un flusso, dichiara lacune/interruzioni e riconcilia i tratti rimasti `in-corso` alla riapertura;
- offre cronologia, ricerca locale, trascrizioni su richiesta, riproduzione, export ZIP di manifest+media e rimozione con conferma dei dati controllati dall'app.

## Evidenze e limiti

I test automatici verificano funzioni di dominio, intervalli continui calcolati da timecode, archivio ZIP, contratto del server ASR e parti della pipeline browser. Gli smoke con clip italiani brevi e il loro limite sono descritti nella matrice di verifica. Queste evidenze non dimostrano ancora una registrazione reale lunga né la qualità su parlato spontaneo.

Restano da eseguire sulla build finale, con una procedura sicura e dati innocui, la cattura continua e la riproduzione/export dei frammenti su Mac M4 Pro e su Windows, compresa una prova lunga, permessi, codec effettivi, quota e recupero dopo guasto. La prova breve Mac dei tre flussi è solo riferita dall'utente; non autorizza uso reale con dati aziendali o persone. Il gate policy aziendale rimane separato e obbligatorio.

Il piano della trascrizione è in [`.scratch/local-transcription/spec.md`](.scratch/local-transcription/spec.md); la [mappa Wayfinder](.scratch/local-transcription/map.md) raccoglie decisioni e verifiche aperte. La [specifica della prima versione](docs/spec.md), il [ticket media e cattura continua](.scratch/diario-di-lavoro/issues/08-solo-media-e-cattura-continua.md) e i documenti datati 2026-09-22 restano evidenza storica.
