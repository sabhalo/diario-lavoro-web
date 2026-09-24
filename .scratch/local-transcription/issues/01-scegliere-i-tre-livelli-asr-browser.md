Parent: ../map.md
Type: research
Status: open

# Scegliere i tre livelli ASR nel browser

## Question

Quali tre combinazioni concrete di modello, quantizzazione e backend JavaScript offrono livelli di qualità crescenti per italiano su Chrome/macOS **e** Chrome/Windows, mantenendo download esplicito, elaborazione locale, timestamp e fallback comprensibile? Quali soglie minime di accuratezza, memoria, download e tempo rendono ciascun livello proponibile, e come viene mostrato un profilo non supportato?

La risoluzione deve distinguere capacità documentata, prova locale sintetica e benchmark su **entrambi** i target. Candidati non selezionati: Whisper multilingual base ONNX, Small q8/WASM e large-v3-turbo ONNX/WebGPU; il precedente Small fp16/WebGPU restituiva testo vuoto. Verificare il comportamento degli **stessi modelli/runtime** sugli stessi clip italiani di microfono e audio del computer con riferimento umano; misurare parole mancanti/errate/inventate, copertura dei confini temporali, primo download, offline, latenza, memoria e storage. Un livello non è disponibile su entrambi gli OS finché smoke test e benchmark non passano su entrambi. Se WebGPU diverge, scegliere un fallback comune o rinviare il livello, senza mostrare modelli diversi sotto la stessa etichetta. Non assegnare etichette di qualità solo per dimensione del modello e non usare modelli `.en` per italiano.
