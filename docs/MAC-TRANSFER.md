# Pacchetto per prova locale su Mac

Il file `diario-lavoro-web-mac.zip` contiene la build statica e questa guida. Non contiene registrazioni, profili browser, credenziali o modello ASR già scaricato.

1. Trasferire lo ZIP solo con un canale locale o aziendale consentito ed estrarlo in una cartella locale del Mac.
2. Aprire Terminale, entrare nella cartella estratta e verificare `python3 --version`. Se `python3` manca o Terminale è vietato, non installare nulla: usare un’anteprima localhost già autorizzata dall’azienda.
3. Avviare `python3 -m http.server 4173 --bind 127.0.0.1` e aprire `http://127.0.0.1:4173/` in Chrome. Fermare con `Ctrl+C` alla fine.
4. Per ASR, usare il pulsante esplicito: prima scarica il runtime da jsDelivr e `Xenova/whisper-tiny` da Hugging Face; nessun audio/testo viene inviato. Scollegare poi la rete e usare “Verifica cache offline”.

## Checklist della build — non ancora superata

- AC1–AC2: monitor, audio sistema e microfono separati, con riascolti nello stesso intervallo.
- AC3–AC4: pause/riprese, flusso perso e opt-in ridotto.
- AC5–AC6: chiusura forzata, revoca, sleep, quota e recupero/lacune.
- AC7–AC8: italiano reale, timestamp/qualità/tempo/RAM, offline dopo cache e audio integro in errore ASR.
- AC9: almeno due ore, spazio, memoria, lag, integrità, ricerca ed export.
- AC10: ZIP di sessione e tratto riaperto, con manifest/media/testo/lacune coerenti.

Annotare versione macOS/Chrome, profilo, procedura, durata, misure ed esito. Il gate policy aziendale per dati reali o altre persone resta distinto e non viene superato da questo pacchetto.
