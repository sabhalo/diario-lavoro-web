# AC7 — esito Mac riferito dall’utente, 2026-09-22

## Esito

**AC7 non superato.** L’utente riferisce che sulla build target la trascrizione italiana locale del **microfono** riconosce quasi nessuna parola, pur avendo selezionato correttamente la sorgente microfono. L’agente non ha osservato campione, schermata, metriche, versione Chrome o output completo; questa è una segnalazione utente, non una misura indipendente.

## Feedback loop locale

È stato creato il campione innocuo sintetico `test/fixtures/italian-synthetic.wav` con la frase: “Il diario di lavoro registra una frase italiana locale.” Il percorso `diagnostics/asr-loop.html` esegue il decoder della build, resample mono 16 kHz, RMS/durata, Whisper con `language: italian`, timestamp e verifica testo.

| Modello | Segnale | Output osservato | Tempo osservato |
| --- | --- | --- | --- |
| `Xenova/whisper-tiny` q8 | 4,51 s, RMS 0,0884 | “Il viario di lavoro registra una frase italiana locale.” | 8,37 s primo run; 3,00 s cache |
| `Xenova/whisper-base` q8 | 4,51 s, RMS 0,0884 | Stesso output | 4,43 s dopo download/cache |

Il loop è ripetibile e distingue segnale assente/debole, decoder/resample rotto e output quasi vuoto. Non riproduce il sintomo Mac: il percorso di base produce testo italiano quasi completo, con un errore lessicale. Base non ha dimostrato un miglioramento su questo unico campione, quindi non diventa default automatico. La build offre anche `Xenova/whisper-small` q8 solo come scelta esplicita: encoder, decoder merged e tokenizer richiesti misurano circa 252 MB prima di runtime/cache; prestazioni e qualità Mac restano ignote.

## Ipotesi aggiornate

1. **Sorgente selezionata sbagliata:** scartata per la prova riferita: l’utente conferma microfono.
2. **Segnale reale mic insufficiente, formato/decodifica o resample del blocco:** aperta. La build ora conserva e mostra per ogni blocco durata decodificata, campioni 16 kHz, RMS, picco, formato, modello e errore, senza inviare media.
3. **Capacità modello/quantizzazione:** aperta ma non dimostrata. Tiny e base producono lo stesso lieve errore sul sintetico; non c’è evidenza che un modello maggiore risolva la voce reale.
4. **Parametri/lingua o input naturale:** aperta. Lingua e task sono esplicitamente `italian`/`transcribe`; serve un campione innocuo naturale sul Mac.

## Nuova prova richiesta sul Mac

1. Aprire la build aggiornata, registrare 5–10 secondi nel solo microfono con una frase innocua ripetibile: “Il diario di lavoro registra una frase italiana locale.”
2. Trascrivere i blocchi microfono confermati, prima con **Rapido** e, solo se desiderato, con **Qualità** dopo il download esplicito.
3. Riportare soltanto: modello scelto, testo prodotto, durata/RMS/picco/formato mostrati nella diagnostica microfono, numero di blocchi falliti, tempo totale, Chrome/macOS e spazio libero approssimativo. Non inviare audio o schermo.
4. Ripetere offline soltanto dopo cache verificata. Restano aperti tutti gli altri AC e il gate policy.

La build non scarica più un modello da “Trascrivi”: quel comando resta disabilitato finché il modello selezionato non è stato preparato dal gesto esplicito “Scarica e prepara ASR locale”. Per ogni blocco conserva anche modello, durata del lavoro ed errore specifico, oltre alle metriche segnale.
