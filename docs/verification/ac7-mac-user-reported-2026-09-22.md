# AC7 — esito Mac riferito dall’utente, 2026-09-22

## Esito

**AC7 non superato.** L’utente riferisce che sulla build target la trascrizione italiana locale del **microfono** riconosce quasi nessuna parola, pur avendo selezionato correttamente la sorgente microfono. L’agente non ha osservato campione, schermata, metriche, versione Chrome o output completo; questa è una segnalazione utente, non una misura indipendente.

## Feedback loop locale

È stato creato il campione innocuo sintetico `test/fixtures/italian-synthetic.wav` con la frase: “Il diario di lavoro registra una frase italiana locale.” Il percorso `diagnostics/asr-loop.html` esegue il decoder della build, resample mono 16 kHz, RMS/durata, Whisper con `language: italian`, timestamp e verifica testo.

| Modello | Segnale | Output osservato | Tempo osservato |
| --- | --- | --- | --- |
| `Xenova/whisper-tiny` q8 | 4,51 s, RMS 0,0884 | “Il viario di lavoro registra una frase italiana locale.” | 8,37 s primo run; 3,00 s cache |
| `Xenova/whisper-base` q8 | 4,51 s, RMS 0,0884 | Stesso output | 4,43 s dopo download/cache |

Il loop è ripetibile e distingue segnale assente/debole, decoder/resample rotto e output quasi vuoto. Non riproduce il sintomo Mac: il percorso di base produce testo italiano quasi completo, con un errore lessicale. Base non ha dimostrato un miglioramento su questo unico campione, quindi non diventa default automatico.

## Profilo ad alta precisione (nuova prova, non esito AC7)

La build mantiene il default **Rapido** (`tiny` q8/WASM) e aggiunge, solo su scelta e download espliciti, **Alta precisione**: `Xenova/whisper-small`, pesi `fp16`, `device: "webgpu"`. Non invia audio o testo; non scarica nulla da “Trascrivi” e non esegue un fallback silenzioso a WASM. Se WebGPU non è disponibile, il profilo termina con un messaggio esplicito.

| Profilo | Backend/pesi | Costo stimato | Limite onesto |
| --- | --- | --- | --- |
| Rapido (default) | Tiny q8 / WASM | 104,9 MB osservati nel loop Windows | È il comportamento leggero invariato; non basta per il feedback microfono Mac. |
| Qualità | Base q8 / WASM | Da scaricare e misurare | Sul solo campione sintetico non ha migliorato Tiny. |
| Alta precisione | Small fp16 / WebGPU | circa 489 MB di pesi (encoder 177 MB + decoder merged 309 MB + tokenizer), più runtime/cache | Richiede Chrome con WebGPU; prestazioni, spazio/cache effettivi e precisione sulla voce Mac non sono ancora misurati. |

Transformers.js 3.8.1 documenta `device: "webgpu"` anche per ASR Whisper e documenta `fp16`/altri `dtype`; segnala però WebGPU come sperimentale in alcuni browser. I file del modello Small pubblicano le componenti fp16 indicate sopra. Fonti: [guida WebGPU di Transformers.js](https://huggingface.co/docs/transformers.js/v3.8.1/en/guides/webgpu), [dtype di Transformers.js](https://huggingface.co/docs/transformers.js/v3.8.1/en/guides/dtypes), [file del modello Xenova/whisper-small](https://huggingface.co/Xenova/whisper-small/tree/main/onnx).

**Distinzione importante:** “Alta precisione” qui significa pesi `fp16` e backend WebGPU. È la stessa architettura Whisper Small che la build precedente esponeva già in q8: non è un modello più grande e non costituisce evidenza di un miglior riconoscimento delle parole del microfono. È una prova controllata, utile proprio per separare il possibile effetto di quantizzazione/backend da segnale e capacità del modello.

`Whisper Medium` non è stato aggiunto automaticamente: i file pubblici riportano circa 776 MB per encoder+decoder merged int8 (313+463 MB) oppure circa 1,53 GB in fp16 (615+916 MB), prima di tokenizer, runtime e cache; il repository contiene 19,5 GB di varianti. Un M4 Max con 64 GB può rendere l’esperimento possibile, ma non dimostra compatibilità, latenza, memoria o timestamp nella combinazione Chrome/Transformers.js 3.8.1 della build. `large-v3-turbo` non viene proposto perché non è stato verificato con questa build/versione né misurato sul Mac; inserirlo ora nasconderebbe un nuovo download pesante e un nuovo rischio sotto un’etichetta di “fix”. Il passo successivo corretto è confrontare sullo **stesso** blocco microfono Rapido e Small fp16/WebGPU; solo se il testo/metriche mostrano un limite di capacità e l’utente autorizza un download più grande, si valuta Medium con un test separato. Fonte dimensioni Medium: [file Xenova/whisper-medium](https://huggingface.co/Xenova/whisper-medium/tree/main/onnx).

## Ipotesi aggiornate

1. **Sorgente selezionata sbagliata:** scartata per la prova riferita: l’utente conferma microfono.
2. **Segnale reale mic insufficiente, formato/decodifica o resample del blocco:** aperta. La build ora conserva e mostra per ogni blocco durata decodificata, campioni 16 kHz, RMS, picco, formato, modello e errore, senza inviare media.
3. **Capacità modello/quantizzazione:** aperta ma non dimostrata. Tiny e base producono lo stesso lieve errore sul sintetico; il nuovo Small fp16/WebGPU è un esperimento esplicito più capace, non una prova che risolva la voce reale.
4. **Parametri/lingua o input naturale:** aperta. Lingua e task sono esplicitamente `italian`/`transcribe`; serve un campione innocuo naturale sul Mac.

## Nuova prova richiesta sul Mac

1. Aprire la build aggiornata, registrare 5–10 secondi nel solo microfono con una frase innocua ripetibile: “Il diario di lavoro registra una frase italiana locale.”
2. Trascrivere gli stessi blocchi microfono confermati, prima con **Rapido** e, solo se desiderato e WebGPU è disponibile, con **Alta precisione** dopo il download esplicito. Non confrontare registrazioni diverse.
3. Riportare soltanto: profilo scelto, testo prodotto, durata/RMS/picco/formato mostrati nella diagnostica microfono, numero di blocchi falliti, tempo totale, Chrome/macOS, disponibilità WebGPU e spazio libero approssimativo. Non inviare audio o schermo.
4. Ripetere offline soltanto dopo cache verificata. Restano aperti tutti gli altri AC e il gate policy.

La build non scarica più un modello da “Trascrivi”: quel comando resta disabilitato finché il profilo selezionato non è stato preparato dal gesto esplicito “Scarica e prepara ASR locale”. Per ogni blocco conserva anche profilo, modello, backend, dtype, durata del lavoro ed errore specifico, oltre alle metriche segnale. **AC7 resta non superato** finché questa prova controllata sul Mac non restituisce un output utile e le metriche richieste.
