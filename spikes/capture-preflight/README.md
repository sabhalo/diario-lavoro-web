# Spike di preflight cattura Mac

> **Spike storico separato dalla build pubblica.** Serve soltanto a leggere il preflight registrato nel ticket 05 e non verifica la cattura continua, la riproduzione o l'export della build corrente. Per avviare l'app usare il [README principale](../../README.md).

Pagina statica per la prova minima del ticket 05. È intenzionalmente separata dall'app: non contiene backend, upload, account, analytics, storage o export. I flussi e i campioni di riascolto restano nella memoria della singola scheda e vengono fermati/eliminati da **Ferma e pulisci**, dal termine di una traccia o dalla chiusura della pagina.

## Cosa verifica e cosa non verifica

Con due clic distinti la pagina richiede:

1. `getDisplayMedia({ video: true, audio: true, systemAudio: "include" })` per la scelta utente di display e possibile audio di sistema;
2. `getUserMedia({ audio: true })` per il microfono.

La pagina mostra `displaySurface`, stato delle tracce e due livelli. I due pulsanti di campionamento registrano cinque secondi **da una sola traccia alla volta** e forniscono due riascolti separati. Non connettono gli analyser agli altoparlanti e non creano un mix, così un risultato dell'uno non viene attribuito all'altro.

`systemAudio: "include"` è una preferenza: Chrome può ignorarla o restituire solo video. La pagina non può imporre monitor invece di finestra/scheda: il selettore resta dell'utente e il risultato viene verificato solo dopo. Una traccia `live` o un livello che si muove non dimostrano da soli il contenuto; servono sia il suono innocuo dell'altra app nel riascolto sistema sia la frase nel riascolto microfono, nello stesso intervallo.

## Avvio sul Mac, senza installare nulla o cambiare policy

Non aprire direttamente `index.html` con `file://`: questa repository **non ha validato** quel percorso su Chrome/macOS e la pagina blocca la prova se `isSecureContext` è falso.

Scegli una delle modalità già consentite dall'azienda:

1. Se sul Mac esiste già un'anteprima locale approvata (per esempio quella dell'IDE), apri questa cartella con essa e prosegui solo se la barra di Chrome mostra `http://localhost/...` e la pagina indica “Contesto sicuro rilevato”.
2. Se l'app `Terminale` e `python3` sono già disponibili, senza installare nulla: nella cartella `spikes/capture-preflight` esegui `python3 --version`. Solo se restituisce una versione, esegui `python3 -m http.server 8000 --bind 127.0.0.1` e apri `http://localhost:8000/` in Chrome. Ferma il server con `Ctrl+C` al termine. Se `python3` manca o è vietato, non installarlo per questo spike.
3. Se non esiste né un'anteprima locale né `python3` autorizzato, chiedi al coordinatore/IT una delle due opzioni: un modo locale approvato per servire questa cartella su `localhost`, oppure una pagina statica HTTPS interna approvata che non riceva né registri dati. Nessun deploy pubblico è richiesto o autorizzato da questo spike.

Prima di cliccare, annota macOS/Chrome/policy come indicato nel ticket 05. Nel selettore scegli **Schermo intero/monitor** e abilita l'audio di sistema se disponibile. Fai prima la prova dell'audio da un'altra app con microfono silenzioso, poi quella della voce con l'altra app silenziosa. Usa [il template di verifica portabile](verification-template.md) (la copia canonica nel repository è in `docs/verification/`) e fermati senza bypass se Chrome, macOS o una policy bloccano il passaggio.

## Trasferimento al Mac

Non viene più distribuito un archivio ZIP di questo spike: avrebbe potuto essere confuso con la build corrente. Il repository pubblico si clona da `https://github.com/sabhalo/diario-lavoro-web.git`, ma questa pagina resta una prova storica separata e non è il flusso da usare per l'app attuale. Per avviare la build corrente seguire [il README principale](../../README.md) o [la guida Mac](../../docs/MAC-TRANSFER.md).

## Test locale svolto durante lo sviluppo

Il controllo statico di `app.js` e il caricamento HTTP sul PC di sviluppo possono rilevare errori della pagina e del contesto. Non costituiscono un esito su macOS, non convalidano permessi/policy aziendali e non rendono superato il ticket 05 o gli AC1–AC2.
