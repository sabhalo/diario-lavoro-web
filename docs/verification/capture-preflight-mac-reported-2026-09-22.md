# Prova breve Mac riferita dall'utente — 2026-09-22

> **Registro storico di un preflight separato.** Non è una prova della build pubblica corrente né una guida per avviarla. Per il flusso attuale usare [MAC-TRANSFER.md](../MAC-TRANSFER.md); cattura, codec, continuità ed export su Mac/Windows restano da verificare.

**Esito: positivo per la fattibilità preliminare dei tre flussi, secondo il resoconto dell'utente.** L'agente non ha osservato direttamente la schermata, le tracce o i campioni. Questo registro non attesta l'idoneità della build finale né l'autorizzazione aziendale all'uso reale.

| Campo | Evidenza disponibile |
| --- | --- |
| Pagina e origine | L'utente ha avviato il server locale sul proprio Mac e la pagina di prova; URL preciso e `isSecureContext` non riportati. |
| Permessi | L'utente ha riferito di aver autorizzato i permessi richiesti; dettagli di Chrome/macOS e policy non comunicati. |
| Video | L'utente ha riferito l'anteprima dell'intero display; valore `displaySurface` e stato delle tracce non trascritti. |
| Audio del computer | Dopo richiesta esplicita di provare un suono da un'app diversa da Chrome e riascoltare solo il campione di sistema, l'utente ha risposto «Sì. È a posto tutto ok». Campione e livello non disponibili all'agente. |
| Microfono | Dopo richiesta esplicita di pronunciare una frase e riascoltare solo il campione microfono nella stessa condivisione, l'utente ha incluso la conferma «Sì. È a posto tutto ok». Campione e livello non disponibili all'agente. |
| Stop e pulizia | Confermati dall'utente con «Ok fatto». |
| Versioni e profilo | Versioni esatte macOS/Chrome, gestione del browser e policy pertinenti: non comunicate. |
| Prove approfondite | AC1–AC10 sulla build, inclusi almeno due ore, ASR locale, offline, recupero, quota ed export: non eseguiti o non riportati. |

La conferma ha sbloccato lo **sviluppo autorizzato dall'utente**. Il [ticket 05](../../.scratch/diario-di-lavoro/issues/05-verificare-mac-aziendale.md) chiude la prova breve riferita; il [ticket 06](../../.scratch/diario-di-lavoro/issues/06-definire-privacy-e-conservazione-aziendale.md) mantiene aperto il gate sulle regole aziendali. Il [template](capture-preflight-mac-template.md) rimane un modello vuoto, non la fonte di questo esito.
