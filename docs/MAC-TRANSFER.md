# Pacchetto per prova locale su Mac

Il file `diario-lavoro-web-mac-2026-09-22.zip` contiene la build statica e questa guida in `docs/MAC-TRANSFER.md`. Non contiene registrazioni, profili browser, credenziali o modello ASR già scaricato.

1. Trasferire lo ZIP solo con un canale locale o aziendale consentito ed estrarlo in una cartella locale del Mac.
2. Aprire Terminale, entrare nella cartella estratta e verificare `python3 --version`. Se `python3` manca o Terminale è vietato, non installare nulla: usare un’anteprima localhost già autorizzata dall’azienda.
3. Avviare `python3 -m http.server 4173 --bind 127.0.0.1` e aprire `http://127.0.0.1:4173/` in Chrome. Fermare con `Ctrl+C` alla fine.
4. Per ASR, scegliere prima il profilo e usare “Scarica e prepara ASR locale”: **Rapido** resta il default Tiny q8/WASM; **Alta precisione** scarica esplicitamente Whisper Small fp16 e usa WebGPU (circa 489 MB di pesi più runtime/cache). Se Chrome non espone WebGPU, Alta precisione mostra l’errore e non passa automaticamente a WASM. Il runtime arriva da jsDelivr e il modello pubblico da Hugging Face; nessun audio/testo viene inviato per l’inferenza. “Trascrivi” non avvia download. Scollegare poi la rete e usare “Verifica cache offline”.
5. L’export produce un solo ZIP64. In Chrome scegliere una destinazione locale quando richiesto: la scrittura può procedere a streaming per sessioni lunghe. Se quella capacità è gestita o assente, il fallback in memoria si interrompe oltre 300 MB invece di creare un archivio incompleto.
6. Per AC7 prima di usare voce reale, aprire `http://127.0.0.1:4173/diagnostics/asr-loop.html`: usa solo il campione sintetico incluso. Per la nuova prova microfono seguire `docs/verification/ac7-mac-user-reported-2026-09-22.md` e riportare esclusivamente metriche e testo, non il media.

## Checklist della build — non ancora superata

- AC1–AC2: monitor, audio sistema e microfono separati, con riascolti nello stesso intervallo.
- AC3–AC4: pause/riprese, flusso perso e opt-in ridotto.
- AC5–AC6: chiusura forzata, revoca, sleep, quota e recupero/lacune.
- AC7–AC8: italiano reale, timestamp/qualità/tempo/RAM, offline dopo cache e audio integro in errore ASR.
- AC9: almeno due ore, spazio, memoria, lag, integrità, ricerca ed export.
- AC10: ZIP di sessione e tratto riaperto, con manifest/media/testo/lacune coerenti.

Annotare versione macOS/Chrome, profilo, procedura, durata, misure ed esito. Il gate policy aziendale per dati reali o altre persone resta distinto e non viene superato da questo pacchetto.
