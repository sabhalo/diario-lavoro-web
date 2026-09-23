Parent: ../map.md
Type: research
Status: resolved

# Verificare LM Studio diretto come ASR locale

## Question

Una versione concreta di LM Studio, con un modello audio/ASR concretamente disponibile, può ricevere **audio** dal browser tramite un URL completo configurabile su loopback e restituire una trascrizione italiana utilizzabile **direttamente**, senza helper che esegua la trascrizione al suo posto, su macOS e Windows?

Questa domanda era un **gate bloccante** quando LM Studio diretto era richiesto. Indagare API e modelli tramite fonti primarie, poi una prova API/prototipo con audio italiano innocuo su entrambi gli OS: rotta, metodo, corpo, risposta, timestamp, CORS, preflight, errori e restrizione al loopback. Un URL libero non rende automaticamente compatibili schemi diversi: definire l'adattatore/protocollo necessario senza fissare una rotta unica. Se LM Studio espone soltanto testo/chat e nessuna elaborazione audio adatta, registrare la prova negativa e riportare il blocco al task principale per una decisione dell'utente; **non** segnare l'helper separato come sostituto di LM Studio diretto e non promettere supporto non verificato. La scelta successiva dell'utente è registrata nella risposta finale sotto.

## Evidence so far

Prova sul server **Windows reale avviato dall'utente**, con risultati comunicati dal task principale; non è una prova Mac:

- `lms server status`: running, porta `1234`.
- `GET /api/v1/models`: HTTP `200`; quattro modelli installati: due embedding, `bonsai-27b` e `gemma-4-e2b`. I due modelli generativi dichiarano `vision`, non `audio`; nessun modello audio installato.
- `POST /v1/audio/transcriptions` con multipart di prova: HTTP `415`, messaggio `application/json required`.
- `POST /v1/audio/transcriptions` con `application/json` e corpo `{}`: HTTP `200`, corpo `{"error":"Unexpected endpoint or method. (POST /v1/audio/transcriptions)"}`. Il codice HTTP da solo non indica successo ASR: il body rifiuta la rotta.
- Nessun audio italiano è stato inviato. La prova dimostra che **questa rotta ASR non è implementata su questo server Windows**, non che qualunque versione futura di LM Studio sia impossibile. CORS/browser, modello audio, qualità, timestamp e macOS restano non verificati.

Fonti ufficiali per confronto con la prova: [OpenAI compatibility](https://lmstudio.ai/docs/developer/openai-compat), [REST chat](https://lmstudio.ai/docs/developer/rest/chat), [Transcribe — coming soon](https://lmstudio.ai/transcribe).

## Answer

L'utente ha scelto esplicitamente **«Motore ASR locale dedicato»** come percorso server di questa evolutiva al posto di LM Studio diretto. La prova Windows sopra documentata resta evidenza negativa circoscritta a quel server, quei modelli e quella rotta; macOS non è stato testato. La compatibilità LM Studio diretta esce dal perimetro corrente, quindi non blocca più il contratto del motore dedicato. Nessuna capacità ASR diretta di LM Studio è dichiarata verificata.
