Parent: ../map.md
Type: task
Status: open
Blocked by: 01

# Verificare il Mac aziendale senza cambiare policy

## Question

Eseguire sul Mac aziendale una prova minima, con versioni macOS/Chrome annotate, che verifichi presenza e contenuto reale di schermo intero, audio di sistema e microfono dopo i normali permessi utente. Annotare impostazioni e blocchi aziendali osservati senza aggirarli. Se il Mac non è accessibile all'agente, fornire al coordinatore il minimo protocollo di prova e registrare il risultato solo quando riportato o osservato.

## Protocollo e prova mancante

**Stato al 2026-09-21: prova non eseguita.** L'agente non ha accesso verificato al Mac aziendale. La baseline documentale [Chrome 142+ / macOS 14.2+](../research/cattura-chrome-macos.md) non è un esito sul dispositivo. Il ticket resta `open` finché una persona sul Mac non riporta gli osservabili sotto, oppure l'agente li osserva direttamente. Una prova Windows, una traccia `live` o la sola opzione `audio: true` non bastano.

### Preparazione sul Mac

1. Usare un momento senza call, notifiche o contenuti aziendali visibili. Scegliere una finestra innocua con movimento riconoscibile (per esempio un orologio) e un breve suono innocuo riprodotto da **un'app diversa da Chrome**. Se possibile usare cuffie, così il microfono non riprende il suono dagli altoparlanti. Non registrare altre persone, conversazioni o dati di lavoro. Se le regole aziendali vietano anche questa prova sintetica, fermarsi e annotare il vincolo.
2. Annotare data, versione completa di macOS da **Informazioni su questo Mac**, versione completa di Chrome da `chrome://version`, e se Chrome indica **Gestito dalla tua organizzazione**. In `chrome://policy` cercare solo le voci pertinenti a cattura schermo e audio (per esempio `ScreenCaptureAllowed`, `ScreenCaptureAllowedByOrigins`, `AudioCaptureAllowed`): riportare nome, valore/stato e se risultano applicate, senza esportare l'intero profilo né condividere URL interni. Assenza di una voce non prova assenza di altre restrizioni.
3. Usare una **pagina di prova locale e attendibile** servita da `localhost` o una pagina HTTPS aziendalmente approvata, in primo piano, con tre funzioni visibili: richiesta su clic di `getDisplayMedia({video: true, audio: true, systemAudio: "include"})`; richiesta separata su clic di `getUserMedia({audio: true})`; anteprima, livello e breve riascolto **separati** dei due flussi audio, senza upload. La pagina deve mostrare `videoTrack.getSettings().displaySurface`, numero/stato delle tracce e nome dell'eventuale errore. Non usare una pagina di terzi che riceva audio o schermo. Se una pagina simile non è disponibile o autorizzata, registrare **«strumento di prova mancante»** e non inventare un risultato. Nessun codice dell'app «Diario di lavoro» è qui implementato o validato.

### Esecuzione minima

1. Avviare la richiesta con il clic previsto dalla pagina. Nel selettore di Chrome scegliere **intero schermo/monitor**, non scheda o finestra, e attivare **audio del sistema/computer** se proposto. Annotare testo e disponibilità dell'opzione. Concedere solo i normali permessi utente consentiti dall'azienda in Chrome e in **Impostazioni di Sistema → Privacy e sicurezza → Registrazione schermo e audio di sistema**; concedere **Microfono** separatamente quando richiesto. Se un controllo è gestito, negato o richiede un amministratore, fermarsi e descriverlo senza cambiare policy, flag, estensioni o driver.
2. Verificare che l'anteprima mostri l'intero monitor con il movimento scelto e che `displaySurface` sia `monitor`. Annotare presenza e stato delle tracce video, audio del display e microfono, oltre a eventuali errori. Se il selettore offre solo scheda/finestra, segnare la prova completa come non superata.
3. Nello **stesso intervallo di cattura**, lasciare il microfono in silenzio e riprodurre per pochi secondi il suono dall'altra app. Controllare livello e riascolto **della sola traccia audio del display**. Poi fermare il suono, pronunciare una breve frase innocua e controllare livello e riascolto **della sola traccia microfono**. Un livello che si muove senza riascolto riconoscibile non conferma il contenuto; se il suono appare soltanto nel microfono, l'audio di sistema non è dimostrato. Non unire i flussi prima del controllo.
4. Fermare con il comando visibile di Chrome/pagina. Eliminare subito eventuali campioni locali, salvo che la policy consenta esplicitamente conservarli per diagnosi. Condividere con il coordinatore **solo il resoconto testuale** seguente, senza audio, video, schermate o dettagli aziendali sensibili.

### Resoconto da riportare

| Campo | Valore da compilare sul Mac |
| --- | --- |
| Data, macOS, Chrome, browser gestito | Versioni esatte e sì/no/non noto |
| Permessi e policy pertinenti | Concesso/negato/gestito/non richiesto; nome e stato delle sole policy rilevanti |
| Selezione | Monitor/scheda/finestra; opzione audio di sistema proposta e attivata sì/no |
| Video | `displaySurface`, traccia presente/live/terminata, monitor intero visibile sì/no |
| Audio altra app | Traccia display presente/live/terminata; suono riconoscibile nel suo riascolto sì/no |
| Microfono | Traccia separata presente/live/terminata; frase riconoscibile nel suo riascolto sì/no |
| Ostacolo | Passaggio, messaggio o nome errore esatto; controllo gestito o policy osservata, senza inferirne la causa se non dimostrata |
| Esito | **Completo verificato** solo con monitor e due campioni audio distinti nello stesso intervallo; altrimenti **non superato**, **non conclusivo** o **non eseguito**, con motivo |

Non dedurre che il test tecnico autorizzi l'uso con dati aziendali o persone: il [gate sulle regole aziendali](06-definire-privacy-e-conservazione-aziendale.md) è separato. Riportare al coordinatore anche se una modalità ridotta è l'unica disponibile, chiamandola esplicitamente **ridotta**.

### Prove successive, non eseguite

La prova breve sopra verifica soltanto la capacità di acquisire i tre flussi. Dopo il gate di approvazione all'implementazione e su una build dell'app, eseguire sullo **stesso Mac/profilo** gli AC della [specifica di esperienza](04-definire-esperienza-e-criteri-di-accettazione.md): registrazione di almeno **due ore** con controllo di continuità, memoria, spazio, lag, blocchi confermati, ricerca ed export (AC9); ASR locale su audio italiano rappresentativo con timestamp, accuratezza, ritardo, prova offline e recupero dell'audio se fallisce (AC7–AC8); persistenza incrementale e riapertura dopo chiusura forzata, revoca, sospensione e spazio esaurito, misurando lacune e riproducibilità dei blocchi confermati (AC5–AC6). Registrare per ciascun caso versione, procedura, misura ed esito; **nessuno di questi test ha oggi un risultato sul Mac**.
