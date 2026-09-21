# Resoconto prova preflight di cattura su Mac

Stato: **non eseguito** (template predisposto il 2026-09-21). Questo file non è un risultato sul Mac aziendale e non cambia lo stato del ticket 05.

Usare [la pagina di spike](../../spikes/capture-preflight/README.md) solo dopo aver verificato che la prova sintetica sia consentita. Non includere audio, video, screenshot, URL interni o l'elenco completo delle policy.

| Campo | Valore osservato sul Mac |
| --- | --- |
| Data, macOS, Chrome, browser gestito | Da compilare |
| Origine della pagina | `localhost` / HTTPS interna approvata; `isSecureContext` sì/no |
| Permessi e policy pertinenti | Concesso/negato/gestito/non richiesto; nome e stato delle sole policy pertinenti |
| Selezione | Monitor/scheda/finestra; opzione audio di sistema proposta e attivata sì/no |
| Video | `displaySurface`; traccia presente/live/terminata; monitor intero visibile sì/no |
| Audio altra app | Traccia display presente/live/terminata; suono riconoscibile nel suo riascolto sì/no |
| Microfono | Traccia separata presente/live/terminata; frase riconoscibile nel suo riascolto sì/no |
| Ostacolo | Passaggio e messaggio/nome errore osservato; controllo gestito o policy visibile, senza inferire cause non dimostrate |
| Esito | `Completo verificato` solo con monitor e due campioni distinti nello stesso intervallo; altrimenti `non superato`, `non conclusivo` o `non eseguito`, con motivo |

Un test su Windows, la sola presenza di una traccia `live`, un livello senza riascolto riconoscibile o l'audio da una scheda Chrome non dimostrano l'audio di sistema dell'altra app. In presenza di blocco aziendale, non cambiare policy, flag, estensioni o driver: annota l'osservabile e riporta il blocco al coordinatore.
