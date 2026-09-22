# AC7 — esito Mac riferito dall’utente, 2026-09-22

## Esito

**AC7 superato solo secondo testimonianza utente.** L’esito più recente dell’utente sulla build target è: trascrizione «decisamente molto, molto meglio» e per ora adeguata. L’agente non ha osservato campione, schermata, metriche, versione Chrome, output completo o benchmark; questa è una testimonianza utente, non una misura indipendente. Il profilo/modello effettivamente usato nella prova positiva è **sconosciuto**: non va dedotto dai profili disponibili nella build o dalle prove Windows.

Cronologia: una prova Mac precedente era stata riferita quasi vuota e una seconda come migliorata ma ancora inutilizzabile. Questi esiti restano contesto diagnostico, non prevalgono sul riscontro più recente e non permettono di attribuire il miglioramento a un fattore specifico.

## Feedback loop locale

È stato creato il campione innocuo sintetico `test/fixtures/italian-synthetic.wav` con la frase: “Il diario di lavoro registra una frase italiana locale.” Il percorso `diagnostics/asr-loop.html` esegue il decoder della build, resample mono 16 kHz, RMS/durata, Whisper con `language: italian`, timestamp e verifica testo.

| Modello | Segnale | Output osservato | Tempo osservato |
| --- | --- | --- | --- |
| `Xenova/whisper-tiny` q8 | 4,51 s, RMS 0,0884 | “Il viario di lavoro registra una frase italiana locale.” | 8,37 s primo run; 3,00 s cache |
| `Xenova/whisper-base` q8 | 4,51 s, RMS 0,0884 | Stesso output | 4,43 s dopo download/cache |

Il loop è ripetibile e distingue segnale assente/debole, decoder/resample rotto e output quasi vuoto. Non riproduce il sintomo Mac: il percorso di base produce testo italiano quasi completo, con un errore lessicale. Base non ha dimostrato un miglioramento su questo unico campione, quindi non diventa default automatico.

## Correzione del profilo ad alta qualità (non esito AC7)

Il profilo Small fp16/WebGPU dell’ultimo pacchetto è stato riprodotto nel loop della build, su Windows e sul campione innocuo incluso: dopo il download esplicito ha restituito `result.text` vuoto e `chunks` vuoto (`textChars=0`, `chunks=0`, `nonEmptyChunks=0`, `timestampedChunks=0`). Quindi non è un difetto di estrazione timestamp e un motore con quell’output non viene più dichiarato pronto. Il fatto è **coerente** con i blocchi Mac che segnalano “ASR senza segmenti”, ma non prova che il driver/browser Mac abbia la stessa causa.

Il profilo fp16/WebGPU è stato ritirato, non degradato silenziosamente. La nuova scelta esplicita **Alta qualità** usa `Xenova/whisper-small` q8/WASM: è lo stesso modello più capace di Tiny, con un backend che nel loop corrente ha prodotto testo e timestamp. Il default **Rapido** resta Tiny q8/WASM.

| Profilo | Backend/pesi | Esito loop corrente | Limite onesto |
| --- | --- | --- | --- |
| Rapido (default) | Tiny q8 / WASM | testo quasi completo, 1 segmento; 7,12 s nel browser di sviluppo | È il comportamento leggero invariato; non basta per il feedback microfono Mac. |
| Qualità | Base q8 / WASM | precedente campione: stesso lieve errore di Tiny | Download e prestazioni Mac non misurati. |
| Alta qualità | Small q8 / WASM | frase sintetica completa, 1 segmento/timestamp; 34,20 s primo run nel browser di sviluppo | Circa 252 MB di pesi (encoder, decoder merged e tokenizer), più runtime/cache. Non dimostra accuratezza o tempo sulla voce naturale Mac. |

La build esegue ora il campione sintetico incluso durante “Scarica e prepara ASR locale”, ancora dentro il gesto esplicito e senza inviare audio o testo. Solo un output con almeno un segmento rende il profilo `pronto`; testo/chunk vuoti rendono lo stato `errore`, con conteggi sicuri nella diagnostica. Se esiste `result.text` ma i chunk timestamp sono solo vuoti, il testo viene mantenuto come un segmento sull’intera durata del blocco e registra `timestampStrategy=intera-durata-blocco; output-senza-chunk`. Le nuove trascrizioni sostituiscono soltanto i segmenti preesistenti dei blocchi riusciti: un rerun fallito conserva audio e testo precedente.

Transformers.js 3.8.1 documenta `device: "webgpu"` per ASR Whisper e i `dtype`, ma WebGPU può avere limiti sperimentali; questa build non ripropone un profilo che il suo loop ha già mostrato vuoto. Fonti: [guida WebGPU di Transformers.js](https://huggingface.co/docs/transformers.js/v3.8.1/en/guides/webgpu), [dtype di Transformers.js](https://huggingface.co/docs/transformers.js/v3.8.1/en/guides/dtypes), [file del modello Xenova/whisper-small](https://huggingface.co/Xenova/whisper-small/tree/main/onnx).

`Whisper Medium` non è stato aggiunto automaticamente: i file pubblici riportano circa 776 MB per encoder+decoder merged int8 (313+463 MB) oppure circa 1,53 GB in fp16 (615+916 MB), prima di tokenizer, runtime e cache; il repository contiene 19,5 GB di varianti. Un M4 Max con 64 GB può rendere l’esperimento possibile, ma non dimostra compatibilità, latenza, memoria o timestamp nella combinazione Chrome/Transformers.js 3.8.1 della build. `large-v3-turbo` non viene proposto perché non è stato verificato con questa build/versione né misurato sul Mac; inserirlo ora nasconderebbe un nuovo download pesante e un nuovo rischio sotto un’etichetta di “fix”. Il passo successivo corretto è confrontare sullo **stesso** blocco microfono Rapido e Small q8/WASM; solo se il testo/metriche mostrano un limite di capacità e l’utente autorizza un download più grande, si valuta Medium con un test separato. Fonte dimensioni Medium: [file Xenova/whisper-medium](https://huggingface.co/Xenova/whisper-medium/tree/main/onnx).

## Ipotesi aggiornate

1. **Sorgente selezionata sbagliata:** scartata per la prova riferita: l’utente conferma microfono.
2. **Segnale reale mic insufficiente, formato/decodifica o resample del blocco:** aperta. La build ora conserva e mostra per ogni blocco durata decodificata, campioni 16 kHz, RMS, picco, formato, modello e errore, senza inviare media.
3. **Capacità modello/quantizzazione:** aperta ma non dimostrata. Tiny e base producono lo stesso lieve errore sul sintetico; Small q8/WASM è più capace di Tiny e funziona sul campione, ma non è una prova che risolva la voce reale Mac.
4. **Parametri/lingua o input naturale:** aperta. Lingua e task sono esplicitamente `italian`/`transcribe`; serve un campione innocuo naturale sul Mac.

## Eventuale prova misurata sul Mac

1. Aprire la build aggiornata, registrare 5–10 secondi nel solo microfono con una frase innocua ripetibile: “Il diario di lavoro registra una frase italiana locale.”
2. Trascrivere gli stessi blocchi microfono confermati, prima con **Rapido** e poi con **Alta qualità** dopo il download/preparazione espliciti. Non confrontare registrazioni diverse.
3. Riportare soltanto: profilo scelto, esito del campione sintetico, testo prodotto, durata/RMS/picco/formato e `out=textChars/chunks/nonVuoti` mostrati nella diagnostica microfono, numero di blocchi falliti, tempo totale, Chrome/macOS e spazio libero approssimativo. Non inviare audio o schermo.
4. Ripetere offline soltanto dopo cache verificata. Il pass riferito di AC7 resta registrato; questa procedura serve soltanto a produrre evidenza misurata. Restano aperti gli altri AC e il gate policy.

La build non scarica più un modello da “Trascrivi”: quel comando resta disabilitato finché il profilo selezionato non è stato preparato dal gesto esplicito “Scarica e prepara ASR locale”. Per ogni blocco conserva anche profilo, modello, backend, dtype, durata del lavoro ed errore specifico, oltre alle metriche segnale. **AC7 è superato solo secondo testimonianza utente**; una prova controllata con i dati sopra renderebbe l'evidenza misurata, senza cambiare lo stato degli altri AC o del gate policy.
