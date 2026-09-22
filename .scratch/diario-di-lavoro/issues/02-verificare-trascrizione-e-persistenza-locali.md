Parent: ../map.md
Type: research
Status: resolved

# Verificare trascrizione e persistenza locali nel browser

## Question

Quali opzioni realmente praticabili consentono trascrizione temporizzata e archiviazione incrementale locale in Chrome/macOS per sessioni lunghe, senza invio automatico di audio o testo a servizi esterni? Verificare prestazioni, download dei modelli, quote e limiti browser, esportazione, recupero dopo chiusura scheda, revoca condivisione, sospensione del Mac e spazio esaurito. Distinguere documentazione da misure sul Mac reale.

## Answer

La [ricerca documentale](../research/trascrizione-persistenza-browser.md) individua una pipeline candidata interamente locale: Whisper con Transformers.js per segmenti temporizzati; audio a blocchi in OPFS; manifest, testo e stato in IndexedDB; download esplicito del modello, verifica offline, controllo quota e persistenza, esportazione utente di audio e testo. Web Speech locale è un'opzione per dettatura, ma non documenta timestamp adeguati e richiede verifica di disponibilità del pacchetto lingua. La specifica MediaRecorder non garantisce che i singoli Blob di una registrazione interrotta siano riproducibili: formato e strategia di segmentazione richiedono una prova sul target. Dopo chiusura improvvisa si può recuperare soltanto quanto confermato su storage; revoca, sospensione e spazio esaurito richiedono rilevamento di lacune e arresto esplicito. Il 2026-09-22 l'utente riferisce che la trascrizione dell'ultima build è «decisamente molto, molto meglio» e per ora adeguata: AC7 è quindi positivo **solo secondo testimonianza utente**. Non sono stati riferiti profilo/modello usato, Chrome, testo, timestamp, metriche o benchmark; tali dati restano sconosciuti. Prestazioni, dimensione del modello, quota effettiva e affidabilità per sessioni lunghe rimangono condizioni di validazione, non risultati acquisiti.
