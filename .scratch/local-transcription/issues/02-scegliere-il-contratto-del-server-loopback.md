Parent: ../map.md
Type: research
Status: open

# Scegliere il contratto del server ASR locale

## Question

Quale contratto minimo deve soddisfare il **motore ASR locale dedicato scelto dall'utente**, configurato tramite **URL completo (host loopback, porta e percorso)** in macOS e Windows: health/capability check, formato audio, lingua, timestamp, risposta, errori, cancellazione e limiti? Come mantenere identiche semantiche su entrambi gli OS pur usando binari/backend specifici, e come associare l'URL configurato al protocollo noto del motore?

La risoluzione deve verificare documentazione primaria e una richiesta reale con audio innocuo e **lo stesso modello multilingue** su entrambi gli OS. Includere CORS/preflight dal browser, confine `localhost`/`127.0.0.1`, policy del Mac gestito, firewall Windows e rifiuto di URL remoti **e redirect fuori loopback**. Persistire l'URL completo; nessuna rotta fissa nell'app. whisper.cpp con lo stesso checkpoint GGML e binari/backend specifici è il candidato multipiattaforma da provare; il suo server nativo usa `/inference`, che può essere esposto direttamente o normalizzato da un piccolo helper. L'eventuale adattatore preserva segmenti, sorgenti, timestamp ed errori. LM Studio diretto è fuori perimetro per decisione dell'utente registrata nel ticket 07.
