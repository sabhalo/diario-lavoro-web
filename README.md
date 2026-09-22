# Diario di lavoro

Web app locale, senza backend, account, analytics o upload automatici, per ricordare e consultare il lavoro svolto. I dati rimangono in IndexedDB nel profilo del browser che la esegue.

## Avvio locale

Serve una origine sicura: `localhost` in sviluppo oppure HTTPS. Su macOS, con `python3` già presente:

```bash
python3 -m http.server 4173 --bind 127.0.0.1
```

Aprire poi `http://127.0.0.1:4173/` nel browser. Eseguire i test puri del dominio con `npm test` (Node 20+).

## Cosa fa

- crea sessioni, richiede un’attestazione prima di catturare e conserva note/eventi/timeline;
- richiede monitor con audio del computer e microfono in due richieste separate; verifica la superficie `monitor` e propone due campioni da riascoltare separatamente;
- registra display e microfono in blocchi brevi distinti, salva prima il blocco e lo chiama `confermato` solo dopo un controllo locale di riproducibilità;
- interrompe il tratto alla perdita di un flusso, dichiara lacune/interruzioni e riconcilia i tratti rimasti `in-corso` alla riapertura;
- offre consultazione dei blocchi, cronologia, ricerca locale di titolo/note/eventi/segmenti, manifest+testo+media in export e rimozione con conferma dei dati controllati dall’app;
- esporta sessioni e singoli tratti in un unico ZIP64; su Chrome con File System Access lo scrive in streaming nella destinazione scelta, mentre il fallback in memoria si ferma onestamente oltre 300 MB;
- con un comando esplicito scarica Transformers.js e il modello Whisper selezionato (`tiny`, `base` o `small`), esegue ASR italiano nel browser sui blocchi confermati e conserva segmenti temporizzati, modello, runtime, run, copertura e diagnostica del segnale; una correzione manuale resta distinta.

## Limiti e gate

Il runtime/modello ASR viene scaricato solo dal pulsante esplicito: codice da jsDelivr e modello pubblico `Xenova/whisper-tiny`, `Xenova/whisper-base` o `Xenova/whisper-small` da Hugging Face, secondo la scelta. Rapido resta Tiny q8/WASM (104,9 MB osservati nel browser di sviluppo). Alta qualità è Small q8/WASM, circa 252 MB di pesi prima di runtime/cache: nel loop sintetico ha restituito testo/timestamp, mentre il precedente Small fp16/WebGPU ha restituito output vuoto ed è stato ritirato. Prima di risultare pronto ogni profilo esegue il solo campione sintetico incluso; un output vuoto porta a stato errore. Questo non prova la qualità sulla voce Mac, che resta da misurare. Il browser scarica questi artefatti, ma non invia audio o testo della sessione per l’inferenza. Dopo il primo download l’utente deve scollegare la rete e usare la verifica cache; il relativo esito, qualità, velocità e memoria vanno ancora misurati su Chrome/macOS. La presenza di una traccia o di un livello non dimostra l’audio catturato: occorrono i due riascolti separati.

La prova breve Mac riferita dall’utente ha sbloccato lo sviluppo, non l’uso reale. L’utente ha poi riferito una trascrizione italiana del microfono quasi vuota e, in una seconda prova, migliorata ma ancora inutilizzabile: **AC7 non è superato** e la causa resta da diagnosticare sul Mac. AC1–AC10, inclusi due ore, recovery dopo guasti, quota, ASR/offline ed export riapribile, vanno eseguiti sulla build in Chrome/macOS. Il gate policy aziendale resta separato e obbligatorio prima di usare dati di lavoro o registrare persone.

I documenti decisionali restano in [`.scratch/diario-di-lavoro/map.md`](.scratch/diario-di-lavoro/map.md), la specifica in [`docs/spec.md`](docs/spec.md) e il piano in [`docs/implementation-plan.md`](docs/implementation-plan.md).

Per diagnosticare ASR senza contenuti reali, aprire [`diagnostics/asr-loop.html`](diagnostics/asr-loop.html) da localhost: usa solo la frase sintetica italiana inclusa, misura RMS/durata/resample e può andare rosso se il riconoscimento è quasi vuoto. L’esito Mac riferito e la procedura di retest sono in [`docs/verification/ac7-mac-user-reported-2026-09-22.md`](docs/verification/ac7-mac-user-reported-2026-09-22.md).
