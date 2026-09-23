# Trascrizione locale a due percorsi — specifica e piano candidati

Stato: **piano pronto per revisione, non implementato**. Questa evolutiva parte dalla build media-only; [mappa](map.md) e [ticket](issues/) conservano domande, prove e dipendenze. La specifica storica in `docs/spec.md` non descrive la build corrente per ASR. L'utente ha scelto un **motore ASR locale dedicato** per il percorso server; [LM Studio diretto](issues/07-verificare-lm-studio-diretto.md) è stato investigato ed escluso da questa evolutiva.

## Contratto di prodotto

1. Dopo aver collegato la cartella archivio, la persona apre una sessione o un tratto e preme **Trascrivi**. Sceglie **Nel browser** (tre livelli con qualità e requisiti espliciti) oppure **Motore locale** (URL completo di loopback configurabile, inclusi porta e percorso). Nessun job ASR parte dalla cattura, dall'apertura dell'app o dal cambio di livello.
2. Entrambi i percorsi lavorano su registrazioni solo audio oppure video con audio. Ogni tratto può produrre due trascrizioni indipendenti, `microfono` e `audio del computer`, se i rispettivi flussi sono presenti. Un'unica vista ordina i segmenti per tempo della sessione, sempre con etichetta di sorgente; due enunciati simultanei restano due righe, non vengono fusi in un testo inventato.
3. Nel percorso server solo audio derivato attraversa HTTP, dopo il clic esplicito. Video, note, titoli e media originali non vengono inviati. L'URL deve puntare a loopback sul computer corrente; nessun cloud/LAN, redirect esterno o upload automatico. Un server non compatibile fallisce prima del job con causa visibile.
4. L'interfaccia, le tre etichette dei livelli, i modelli associati a ciascuna etichetta quando disponibili, le azioni, lo schema dei risultati, ricerca ed export sono funzionalmente uguali su macOS e Windows. Binari/backend del motore possono differire dietro lo stesso contratto. Un livello/browser o motore non viene dichiarato disponibile su entrambe le piattaforme prima di smoke test e benchmark su entrambe.
5. Media originali, frammenti e cattura continua restano conservati e riproducibili secondo le regole dell'archivio attuale. Un errore, annullamento o riavvio ASR non modifica lo stato `salvato` del media né inventa copertura testuale.

## Livelli browser: candidati e criterio di scelta

| Livello UI | Candidato, non ancora selezionato | Gate per mostrarlo come disponibile |
| --- | --- | --- |
| Rapido | Whisper multilingue base ONNX/WASM | Stesso checkpoint/runtime e prova italiana su Chrome/macOS e Chrome/Windows; memoria e latenza entro budget concordato. |
| Bilanciato | Whisper Small q8/WASM | Idem; benchmark dimostra utilità rispetto a Rapido. La qualità soddisfacente riportata in passato è stata poi giudicata insufficiente e non vale come accettazione. |
| Massima qualità | Whisper large-v3-turbo ONNX/WebGPU | Stesso modello e semantica sui due OS; fallback comune se WebGPU diverge, oppure livello rinviato. Non usare un modello diverso sotto la stessa etichetta. |

La selezione finale avviene con gli stessi clip italiani innocui di microfono e audio del computer e trascrizione umana di riferimento. Si contano parole mancate, errate e inventate; si calcolano WER/CER dove il confronto ha senso e si esaminano separatamente silenzi, accavallamenti, copertura dei confini e timestamp. Si misurano inoltre latenza, download iniziale, ripetizione offline, memoria e spazio, fissando soglie numeriche nel ticket di accettazione prima di scegliere i tier. Modelli `.en` e il precedente Small fp16/WebGPU che restituiva testo vuoto non sono scelte preapprovate. Nessun profilo viene promesso in base alla sola dimensione del modello; large-v3-turbo/WebGPU resta candidato e può essere rinviato se non raggiunge parità.

Il download del modello richiede azione esplicita, mostra dimensione/provenienza e stato, ed è distinto dall'avvio della cattura. Dopo download verificato, il job browser deve funzionare offline. Un modello non pronto o non supportato lascia disponibile il media e indica come riprovare.

## Motore locale dedicato

- Baseline candidata: **whisper.cpp** con lo stesso checkpoint GGML multilingue per macOS e Windows, binari/backend adatti a ciascun OS. Non è ancora validata l'installazione, la qualità o la prestazione sui target. Un piccolo adattatore locale può normalizzare richieste e risposte; il motore resta dedicato e locale. MLX non può essere l'unico runtime perché è Mac-only.
- Il campo URL conserva **schema, host loopback, porta e percorso interi**. Il contratto dell'adattatore definisce health/capability check, richiesta audio multipart o altro formato documentato, lingua `it`, timestamp, risposta normalizzata, errori e annullamento. Non fissare nell'app `/v1/audio/transcriptions`: il server nativo whisper.cpp può usare `/inference`. L'URL da solo non converte formati/protocolli arbitrari.
- Preflight prima di abilitare il job: schema ammesso, host `localhost`, `127.0.0.1` o `[::1]` verificato, porta, risposta health compatibile, CORS per l'origine effettiva dell'app, assenza di redirect fuori loopback, modello italiano caricato e limite di input. Le credenziali non sono assunte. Un controllo endpoint può usare audio innocuo solo con azione esplicita della persona.
- Il browser prepara audio per una sorgente alla volta e invia soltanto i bytes audio con identificatori tecnici minimi del job. L'helper non riceve un file WebM video anche se contiene audio. Risposte solo testo senza timing sono `non temporizzate`; la vista non inventa timestamp. L'eventuale allineamento richiede una prova separata.
- Una chiusura/crash del motore marca il job `errore` o `parziale`, con segmenti e intervalli già confermati preservati. Retry crea una nuova versione, non sovrascrive silenziosamente l'originale.

## Preparazione delle sorgenti

La sorgente `microfono` è già un WebM audio separato. La sorgente `display` conserva video con audio del computer; la pipeline ASR ne demuxa **solo la traccia audio**. Prima della decodifica, i frammenti `MediaRecorder` per `recordingId` e sorgente devono essere letti in ordine dall'indice 0/header; i frammenti successivi non sono autonomi. Indici mancanti o header assente danno copertura parziale/non elaborabile, mai continuità fittizia.

Per le nuove catture, valutare un flusso audio sidecar dal track del sistema registrato in parallelo, senza fermare o spezzare il recorder video. Questo riduce il costo ASR ma aggiunge sincronizzazione e spazio, perciò passa una prova di non regressione della cattura. Per media storici, implementare estrazione incrementale WebM con limiti di memoria; se non è fattibile per una durata target, dichiarare quel limite prima della consegna. Non concatenare ore di video in un unico Blob né chiamare `decodeAudioData` su tutto il file. L'audio preparato è derivato temporaneo, eliminato dopo il job salvo necessità di recupero esplicitata e verificata. La sorgente media originale non viene riscritta.

Il formato audio-only nuovo è selezionabile nel flusso di cattura. L'acquisizione dell'audio del computer può comunque richiedere il picker di schermo di Chrome: `audio-only` descrive il **file salvato**, non una promessa di cattura di sistema senza permessi. La disponibilità del track e la resa su Mac/Windows richiedono prova reale; una modalità con solo microfono resta etichettata come tale.

## Archivio, ricerca ed export

Estendere `FileArchive` e il suo journal nella **cartella scelta** con metadati dei `transcriptRuns` e segmenti per sorgente/registrazione. Ogni run registra percorso (`browser`/`motore locale`), livello o modello, versione, stato (`in attesa`, `in elaborazione`, `parziale`, `completa`, `errore`, `annullata`), intervalli coperti, errori e tempo. Ogni segmento registra `sessionId`, `recordingId`, sorgente, intervallo sulla timeline della sessione, testo originale, provenienza e riferimento ai blocchi media. Le correzioni utente e le nuove elaborazioni sono versioni distinte; la vista attiva è esplicita.

Scritture e delete dei risultati passano per il journal e la verifica dell'archivio. Riapertura dopo crash riconcilia run, segmenti e file presenti prima di mostrare `completa`. La ricerca indicizza solo testo effettivamente presente, distingue sorgente/versione, restituisce sessione e salto temporale quando disponibile; una ricerca vuota o senza copertura non implica silenzio nel media. L'export di sessione o tratto include testo per sorgente, versioni attive e un manifest con stato, modello, intervalli e lacune; mantiene i file media/raw già previsti. La rimozione della sessione elimina anche trascrizioni e derivati controllati dall'app, e segnala residui/fallimenti.

Le vecchie trascrizioni IndexedDB **non si presumono recuperabili**: `src/core.js` elimina lo store `transcripts` in upgrade e `FileArchive.migrateLegacy` copia solo sei store media/metadati. Un import storico compare nel piano solo dopo evidenza di una copia ancora leggibile; l'assenza va dichiarata, non colmata con testo sintetico.

## Sequenza di implementazione dopo approvazione

1. **Gate di fattibilità:** misurare i tre candidati browser su Mac e Windows; provare lo stesso checkpoint del motore dedicato su entrambi, il contratto loopback/CORS, e demux audio di un WebM reale da ogni OS con memoria limitata. Fissare modelli, soglie e adapter solo dopo i risultati. Se un gate fallisce, aggiornare piano e ottenere una decisione sul perimetro prima di promettere parità.
2. **Dati e preparazione audio:** introdurre run/segmenti con journal e recupero; reader per blocchi ordinati e demux audio incrementale; eventuale sidecar per nuove catture dopo prova di non regressione. Nessuna modifica ai media originali.
3. **Percorsi ASR e UI:** implementare modello browser scelto per ciascun livello, motore locale con URL completo, preflight e clic esplicito, progress/annullamento/retry; vista cronologica con etichette di sorgente e stati parziali.
4. **Integrazione:** ricerca, export, delete, riapertura dopo crash, offline, errori CORS e server spento; migrazione solo di dati storici dimostrati recuperabili.
5. **Accettazione:** test automatici mirati e prove reali identiche su Mac e Windows; matrice con esiti distinti. Il gate policy per dati aziendali reali resta separato dalla consegna tecnica.

## Criteri di accettazione

- I due percorsi richiedono clic; nessuna richiesta ASR parte spontaneamente. Il server vede solo audio, verificato con test di payload per audio-only e video+audio; URL pubblico/LAN o redirect esterno sono rifiutati.
- Tre livelli browser con modello/versione dichiarati; ciascuno supera la stessa prova italiana su Mac e Windows prima di essere esposto come disponibile. Offline dopo preparazione verificata.
- Motore dedicato avviabile su Mac e Windows con lo stesso modello e contratto; URL completo configurabile, preflight CORS/health e trascrizione italiana con timing verificato. Differenze di prestazione misurate, nessuna differenza silenziosa di funzionalità.
- Microfono e audio del computer generano run indipendenti; la vista unica mostra ordine, sovrapposizioni, etichette, lacune e stati parziali. La ricerca e l'export mantengono questi riferimenti.
- Registrazioni solo audio e video+audio, brevi e lunghe, vengono elaborate senza caricare tutto il video in memoria. La cattura continua e i file raw restano intatti; ASR fallita non causa perdita media.
- Dopo chiusura forzata, file mancante, server spento, CORS negato, spazio esaurito, annullamento e delete, archivio e UI dichiarano soltanto risultati verificati. La sessione eliminata non lascia trascrizioni controllate dall'app.
- La matrice registra versione OS/Chrome, hardware, modello, clip/riferimento umano, parole omesse/inventate/errate, WER/CER ove utili, silenzi, accavallamenti, copertura e timestamp, download, offline, latenza, picco memoria e spazio. Include sessioni lunghe con prova strumentata che l'intero video non venga caricato in RAM. Un pass Windows non sostituisce Mac, né viceversa. L'uso con dati aziendali veri richiede verifica separata delle policy applicabili.
