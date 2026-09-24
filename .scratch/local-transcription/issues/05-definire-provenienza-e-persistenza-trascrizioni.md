Parent: ../map.md
Type: grilling
Status: open
Blocked by: 03, 04

# Definire provenienza e persistenza delle trascrizioni

## Question

Quali metadati e file nella cartella archivio rappresentano job, sorgente microfono/computer, intervalli, modello, percorso, versione, segmenti, errori, retry e correzioni, mantenendo ricerca, export e cancellazione coerenti? Come si evita che una trascrizione parziale o non allineata sembri completa nella vista cronologica?

La risoluzione deve produrre solo il delta rispetto al contratto archivio esistente: journal e recupero, scrittura verificata, delete, ricerca ed export. Deve distinguere i nuovi dati da eventuali trascrizioni legacy e non presumere che queste ultime siano recuperabili: lo store IndexedDB è stato eliminato in upgrade e la migrazione esistente non lo trasporta. Stabilire quali evidenze permettono di offrire import o di dichiarare perdita storica.
