Parent: ../map.md
Type: research
Status: open

# Scegliere il contratto del server ASR locale

## Question

Quale contratto minimo deve soddisfare il **motore ASR locale dedicato scelto dall'utente**, configurato tramite **URL completo (host loopback, porta e percorso)** in macOS e Windows: health/capability check, formato audio, lingua, timestamp, risposta, errori, cancellazione e limiti? Come mantenere identiche semantiche su entrambi gli OS pur usando binari/backend specifici, e come associare l'URL configurato al protocollo noto del motore?

La risoluzione deve verificare documentazione primaria e una richiesta reale con audio innocuo e **lo stesso modello multilingue** su entrambi gli OS. Includere CORS/preflight dal browser, confine `localhost`/`127.0.0.1`, policy del Mac gestito, firewall Windows e rifiuto di URL remoti **e redirect fuori loopback**. Persistire l'URL completo; nessuna rotta fissa nell'app. whisper.cpp con lo stesso checkpoint GGML e binari/backend specifici è il candidato multipiattaforma da provare; il suo server nativo usa `/inference`, che può essere esposto direttamente o normalizzato da un piccolo helper. L'eventuale adattatore preserva segmenti, sorgenti, timestamp ed errori. LM Studio diretto è fuori perimetro per decisione dell'utente registrata nel ticket 07.

## Evidence so far

- L'esecutore ha implementato `local-asr/server.py` e documentato il contratto in `local-asr/README.md`: GET e POST sullo **stesso URL configurato**, input WAV PCM16 mono 16 kHz, lingua italiana, CORS per origine esatta, host loopback, segmenti normalizzati, limiti ed errori espliciti. **Otto test Python sintetici** risultano passati su Windows; sono verifiche del contratto, non della qualità ASR.
- Il 2026-09-24, sul Windows reale i7-8700/16 GB/RTX 2070, l'helper a `http://127.0.0.1:8765/asr` ha usato `whisper-cli` v1.9.2 **CPU** e modello multilingue `ggml-large-v3-turbo-q5_0.bin` con SHA-1 `e050f7970618a659205450ad97eb95a18d69c9ee` verificato. Due clip italiane CC0 di 2,64 s sono state trascritte esattamente rispetto al riferimento; i segmenti erano 0,00–2,40 s e 0,00–2,46 s. Una richiesta ha richiesto 25,16 s end-to-end. Dettagli e clip sono nella [matrice di verifica](../../../docs/verification/local-transcription-matrix.md).
- La release CUDA v1.9.2 inizialmente riportava `no GPU found`; dopo l'aggiunta locale di cuBLAS, il log ha riconosciuto la RTX 2070 e la stessa clip è stata trascritta esattamente. Su quel **singolo clip**, `whisper_print_timings` ha misurato **49,28 s CUDA contro 24,48 s CPU**: CUDA non è il backend prestazionale predefinito su questo PC sulla base di questa prova. La misura di 25,16 s sopra è end-to-end CPU e usa un'altra clip.
- Chrome Windows ha superato uno smoke con due livelli browser q8/WASM e GET/POST browser→helper su clip italiane CC0. Questo conferma una connessione browser locale sul caso provato, non l'intera matrice CORS/redirect o la qualità del prodotto.
- **Ancora aperto:** esecuzione dello stesso modello/contratto su macOS, casi CORS/preflight/redirect non coperti dallo smoke, audio estratto da video, sessioni lunghe, terzo livello browser, qualità su parlato rappresentativo, silenzi e sovrapposizioni. Il ticket resta `open`; lo smoke Windows non chiude la parità richiesta.
