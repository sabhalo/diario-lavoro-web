# Diario di lavoro

Web app locale, senza backend, account, analytics o upload automatici. All'avvio richiede una cartella locale scelta dalla persona: sessioni, media, note, eventi, lacune, manifest e journal vivono come file in quella cartella. Nel browser resta soltanto il riferimento alla cartella, non una copia dei dati di lavoro.

Il repository pubblico corrente è [sabhalo/diario-lavoro-web](https://github.com/sabhalo/diario-lavoro-web); il branch predefinito è `codex/media-only-continuous-capture`. Per avviare la build corrente usare il clone Git descritto sotto, non pacchetti ZIP storici.

## Stato della build

La build corrente registra solo **video e audio**: monitor con eventuale audio del computer e microfono restano flussi distinti. Non include ASR, trascrizione, modelli Whisper, download di modelli o ricerca/esportazione testuale derivata dall'audio.

Per ogni tratto l'app mantiene un `MediaRecorder` vivo per flusso e riceve frammenti progressivi ogni 30 secondi; non riavvia l'encoder fra due frammenti. Gli intervalli sono costruiti dai timecode del recorder con fallback monotono, per evitare lacune introdotte dalla finalizzazione o dalla scrittura di un blocco precedente. Display usa preferibilmente WebM VP8/Opus a 4 Mb/s più 128 kb/s audio; il microfono usa WebM/Opus a 128 kb/s, con fallback alla configurazione supportata dal browser.

Un frammento `MediaRecorder` dopo il primo non è necessariamente un file apribile da solo: **salvato** significa che il suo Blob è stato scritto, chiuso e riaperto nella cartella, non che debba contenere un header autonomo. Per riproduzione ed export l'app ricompone in ordine i frammenti consecutivi dello stesso tratto e flusso, partendo dal frammento iniziale. Le registrazioni legacy con la vecchia etichetta `non verificabile` sono incluse nella migrazione se il Blob esiste. Se manca l'header iniziale o un indice intermedio, il manifest lo dichiara e non presenta il resto come file riapribile.

## Avvio locale e test

Serve una origine sicura: `localhost` in sviluppo oppure HTTPS.

```bash
python3 -m http.server 4173 --bind 127.0.0.1
```

Aprire `http://127.0.0.1:4173/` nel browser. Eseguire i test del dominio con Node 20+:

```bash
npm test
```

## Avvio sul Mac

Non è un'app eseguibile `.app`: è una web app statica che Chrome deve aprire da `localhost` o HTTPS. Dopo la pubblicazione del branch, sul Mac:

```bash
git clone https://github.com/sabhalo/diario-lavoro-web.git diario-lavoro-web
cd diario-lavoro-web
git switch codex/media-only-continuous-capture
python3 -m http.server 4173 --bind 127.0.0.1
```

Aprire `http://127.0.0.1:4173/` in Chrome e fermare il server con `Ctrl+C` al termine. Per aggiornare un clone già esistente, usare `git pull --ff-only` sul branch pubblicato. Servono Git, Python 3 e Chrome già consentiti dall'ambiente; non installare componenti o cambiare policy se mancanti.

Al primo avvio scegliere una cartella locale dedicata e concedere il permesso lettura/scrittura richiesto da Chrome. Se il handle è revocato, l'app rimane bloccata finché non si ricollega una cartella; non esiste fallback in IndexedDB, OPFS o cache browser.

## Esportare una registrazione già salvata sul Mac

1. Aggiornare il clone con `git pull --ff-only`, riavviare il server e ricaricare la pagina in Chrome.
2. Scegliere una cartella dedicata e usare **Migra dati browser** se appare. La migrazione copia e riapre ogni file, è ripetibile dopo un'interruzione e cancella la copia IndexedDB soltanto al termine verificato.
3. Selezionare **Esporta tratto** oppure **Esporta**. Lo ZIP contiene `manifest.json` e un file media ricomposto per ogni sequenza continua di recorder/flusso; monitor e microfono restano separati.
4. Estrarre lo ZIP e aprire il file media nel browser o in un player compatibile. Se il manifest segnala header iniziale o continuità mancanti, quel segmento non viene spacciato per file riproducibile.

Questo percorso è coperto da test sintetici ma non è ancora una prova eseguita sul Mac o su Windows.

Al primo avvio di una cattura Chrome chiede di selezionare il monitor e l'eventuale audio del computer, quindi il microfono separatamente. Scegliere solo contenuti innocui per le prove e concedere permessi del sito/macOS solo se consentiti dalla policy aziendale. Non scegliere automaticamente modalità ridotte né aggirare permessi negati.

## Cosa fa

- crea sessioni, richiede un'attestazione prima della cattura e conserva note, eventi e timeline;
- richiede monitor/audio del computer e microfono in due richieste separate; verifica la superficie `monitor` e propone due campioni da riascoltare separatamente;
- salva frammenti media progressivi senza stop/start periodico del recorder;
- interrompe il tratto alla perdita di un flusso, dichiara lacune/interruzioni e riconcilia i tratti rimasti `in-corso` alla riapertura;
- offre cronologia, ricerca locale di titoli/note/eventi, riproduzione, export ZIP di manifest+media e rimozione con conferma dei dati controllati dall'app.

## Evidenze e limiti

I test automatici verificano funzioni di dominio, intervalli continui calcolati da timecode, archivio ZIP e preflight. Il browser locale è stato caricato senza comandi ASR e senza errori in console. Queste evidenze non dimostrano una registrazione reale.

Restano da eseguire sulla build finale, con una procedura sicura e dati innocui, la cattura continua e la riproduzione/export dei frammenti su Mac M4 Pro e su Windows, compresa una prova lunga, permessi, codec effettivi, quota e recupero dopo guasto. La prova breve Mac dei tre flussi è solo riferita dall'utente; non autorizza uso reale con dati aziendali o persone. Il gate policy aziendale rimane separato e obbligatorio.

Il piano operativo della modifica è in [`.scratch/diario-di-lavoro/issues/08-solo-media-e-cattura-continua.md`](.scratch/diario-di-lavoro/issues/08-solo-media-e-cattura-continua.md). La specifica candidata storica è in [`docs/spec.md`](docs/spec.md); la nota iniziale ne indica le sezioni ASR superate dalla build corrente. I documenti datati 2026-09-22 e lo spike di preflight sono evidenza storica, non istruzioni per avviare questa build.
