# Diario di lavoro — specifica candidata della prima versione

Stato: **approvata per l'implementazione il 2026-09-22; build da validare sul Mac aziendale**. Questa specifica sintetizza le scelte delegate registrate nella [mappa Wayfinder](../.scratch/diario-di-lavoro/map.md) e nei [ticket 01–07](../.scratch/diario-di-lavoro/issues/). Il [ticket «Verificare il Mac aziendale senza cambiare policy»](../.scratch/diario-di-lavoro/issues/05-verificare-mac-aziendale.md) registra una prova breve positiva dei tre flussi riferita dall'utente. AC7 è superato **solo secondo testimonianza utente**: l'ultima trascrizione è riferita «decisamente molto, molto meglio» e per ora adeguata; profilo/modello, metriche, Chrome e benchmark non sono stati forniti. La [matrice AC](verification/acceptance-matrix-2026-09-22.md) separa questo esito dagli AC locali e non verificati. Il [piano](implementation-plan.md) indica prove e dipendenze; il gate di sviluppo è stato approvato, mentre quelli tecnici e aziendali restano distinti.

## Obiettivo e perimetro

Una persona registra intenzionalmente il lavoro, ritrova sessioni e passaggi rilevanti e conserva un resoconto fedele anche dopo stop o interruzioni. La prima versione è una web app locale per Chrome su Mac aziendale, senza driver/helper né privilegi amministratore. Il requisito completo è catturare **monitor intero, audio del computer proveniente anche da altre app e microfono**, nello stesso tratto. Offre registrazione e recupero incrementale, trascrizione locale temporizzata, cronologia, ricerca, riproduzione ed export audiovisivo e testuale.

Non sono nella prima versione riassunti o punteggi automatici, attribuzione automatica dei parlanti, sincronizzazione cloud o registrazione nascosta. Una modalità ridotta (per esempio scheda e microfono) può essere usata solo con scelta esplicita e **non soddisfa il requisito completo**.

## Stato delle evidenze e gate

La [ricerca documentale sulla cattura](../.scratch/diario-di-lavoro/research/cattura-chrome-macos.md) propone Chrome 142+ e macOS 14.2+ come baseline prudente: non prova che il profilo gestito conceda la combinazione. La [ricerca su ASR e persistenza](../.scratch/diario-di-lavoro/research/trascrizione-persistenza-browser.md) propone tecnologie candidate, senza misure su prestazioni, quota o recupero. Le regole aziendali applicabili, la conservazione, il consenso e l'export con dati reali non sono stati accertati; le scelte del [ticket privacy](../.scratch/diario-di-lavoro/issues/06-definire-privacy-e-conservazione-aziendale.md) sono default di progetto, non autorizzazioni.

Tre gate distinti:

1. **Prima di implementare:** approvazione esplicita dell'utente alla specifica/piano e all'avvio della fase Terra High. Fino ad allora si preparano solo documenti e task.
2. **Prima di dichiarare il requisito tecnico completo:** prova breve sul Mac/profilo di destinazione secondo il ticket 05, poi suite AC1–AC10 sulla build reale, incluse due ore e guasti. Un esito documentale o Windows non sostituisce queste prove.
3. **Prima dell'uso con dati aziendali reali o persone:** evidenza delle policy vigenti e degli obblighi di informazione/consenso, conservazione, cancellazione ed export per l'ambito effettivo. Il superamento tecnico non apre questo gate.

Se la combinazione completa è vietata o indisponibile, registrare causa ed evidenza, fermare la dichiarazione di conformità al requisito completo e chiedere una decisione esplicita sul perimetro. Non introdurre bypass, driver, flag o modifiche a policy. Un prodotto ridotto può essere consegnato solo come tale, con accettazione distinta.

## Linguaggio e invarianti

Si usa il [glossario canonico](../CONTEXT.md). La **sessione di lavoro** è l'episodio nominabile e l'unità principale di ricerca/export; può esistere senza cattura. La **registrazione** è un tratto continuo: pausa, stop e ripresa generano tratti distinti. I **flussi** hanno presenza e intervalli propri. Un **blocco confermato** è recuperabile e riproducibile; la sua conferma non colma intervalli adiacenti. Una **lacuna** dichiara contenuto assente o incerto. Eventi, note e segmenti di trascrizione restano categorie diverse.

## Esperienza visibile

1. La persona crea o apre una sessione, ne modifica il titolo e rende l'**attestazione di registrazione** prima di ogni sessione con cattura. Il testo dell'attestazione non pretende di certificare autorizzazioni di altri. L'avvio è manuale e richiede un gesto utente.
2. Il preflight chiede monitor e audio del computer tramite la scelta di Chrome, e microfono separato. Verifica superficie `monitor`, presenza/stato delle tracce e segnala in modo specifico selezione errata, permesso negato, flusso assente o errore quando distinguibili. `audio: true` e traccia `live` non dimostrano audio effettivo.
3. La prova guidata usa suono innocuo da un'altra app e voce breve, con livelli e riascolto **separati**; conserva esito e istante. Solo esito positivo giustifica «cattura completa verificata». Se le tracce esistono ma manca un segnale verificabile, lo stato persistente è «segnale non verificato». Silenzio naturale successivo alla prova positiva non è perdita di flusso.
4. Durante il tratto sono visibili sessione, stato/modalità della registrazione, flussi effettivi, stato di salvataggio e stop. Pausa chiude il tratto; riprendi richiede nuova scelta e crea un tratto nella stessa sessione. Concludi chiude la sessione logica.
5. La terminazione di un flusso richiesto ferma il tratto completo. Si conferma il recuperabile, si segnala il flusso perso e si offre un nuovo tentativo completo o un nuovo tratto ridotto con opt-in. Quota o scrittura fallita fermano la cattura e lasciano disponibile l'export del confermato. Alla riapertura dopo crash la persona sceglie se riprendere la sessione interrotta con un tratto nuovo.
6. La cattura può partire senza modello ASR pronto se il preflight storage riesce. Stato «trascrizione in attesa», «parziale» o «errore» espone causa, copertura e retry locale. Primo download di codice/modello solo su azione esplicita e con provenienza/dimensione comunicata. Dopo cache verificata, funzioni principali e rielaborazione ASR devono funzionare offline.
7. Cronologia e ricerca mostrano sessioni, tratti, eventi, lacune e copertura testuale; ogni risultato apre la sorgente e, se esiste, il punto temporale. L'export integrale o di singolo tratto dichiara ambito, flussi, modalità, lacune e trascrizione incompleta. La persona può rimuovere una sessione con conferma e un esito che distingua successo da residui.

## Dati, stati e tempo

Ogni entità ha ID stabile e riferimenti espliciti. La sessione conserva titolo, istanti, zona oraria e stato `aperta`, `interrotta/in attesa di scelta` o `conclusa`. Ogni registrazione conserva sessione, inizio/fine, offset, stato `preparazione`, `in corso`, `terminata` o `interrotta`, causa, modalità richiesta/effettiva ed esito temporizzato dei controlli. I flussi conservano tipo e intervalli reali; i blocchi ordine, intervallo, flussi presenti, formato e stato di scrittura/verifica. Eventi, note, lacune e segmenti ASR hanno riferimenti alla sessione e, dove pertinente, alla registrazione.

Gli intervalli sono `[inizio, fine)` sulla timeline della sessione, con istanti assoluti e zona oraria per la cronologia. Va conservata la mappatura dai tempi originali di cattura al tratto e alla sessione. Sleep o cambio di clock non diventano contenuto registrato; confini non misurabili restano incerti. Media, testo e export non dichiarano continuità oltre i blocchi verificati. Il checkpoint avanza solo dopo scrittura completa, coerenza dei metadati e verifica di riproducibilità. Alla riapertura si riconciliano manifest e file reali; un blocco mancante/non verificabile produce lacuna o stato incerto. Nessuna transazione atomica tra media e metadati è presunta.

La trascrizione ha stato indipendente `in attesa`, `in elaborazione`, `parziale`, `completa` o `errore`, copertura e provenienza. Ogni segmento contiene intervallo, sorgente e blocchi, motore/modello/versione ed esito. L'originale ASR resta distinto dalle correzioni versionate e dalla versione attiva; una rielaborazione crea una nuova versione. Segmenti la cui sorgente media non è più verificabile lo dichiarano. Nessun parlante è attribuito senza verifica.

La ricerca locale restituisce **sessioni** con hit per documento sorgente (titolo, nota, evento, segmento), snippet, stato e salto temporale se pertinente. Cerca la correzione attiva, altrimenti l'originale; un filtro esplicito può cercare l'originale. Filtri data e sessione sono richiesti. Aggiornamenti e rimozioni dell'indice devono essere completati prima che la UI lo dichiari aggiornato; copertura parziale è visibile.

L'export usa manifest strutturato versionato e file media/testo separati. L'export di un tratto cita la sessione madre e include solo dati e lacune pertinenti. Il testo ordinario usa versione attiva, timestamp e provenienza essenziale; un archivio completo opzionale include versioni ancora conservate con avviso di sensibilità. La conclusione dell'export richiede chiusura riuscita e prova di riapertura sul target.

## Architettura candidata, da validare

Pagina web locale in contesto sicuro (`localhost` durante sviluppo o origine approvata), con controller per stati di sessione/cattura, preflight dei tre flussi, codifica/segmentazione, repository locale, worker ASR, indice di ricerca e generatore di export. `getDisplayMedia` sceglie il monitor e chiede audio di sistema; `getUserMedia` chiede separatamente il microfono. Audio di sistema e microfono restano distinguibili per prova, metadati e rielaborazione anche se un formato di riproduzione richiede un mix derivato.

OPFS è candidato per media incrementali; IndexedDB per manifest, entità, segmenti e indice; cache locale per codice/modello. `navigator.storage.estimate()` e `persist()` sono controlli e richieste, non garanzie. Un worker con Whisper/Transformers.js è candidato per ASR temporizzato italiano, con backend WebGPU o WASM scelto dopo misura. I Blob `MediaRecorder` da `timeslice` **non sono garantiti riproducibili singolarmente**: la strategia di segmenti autonomi, formato MIME, durata e checkpoint va dimostrata sul target prima di chiamare un blocco «confermato». La tecnologia di indice e la modalità di distribuzione restano scelte attuative subordinate a volume, offline, policy e prove Mac.

## Privacy e conservazione

Media, testo, note, indice e metadati restano locali per default. Nessun upload, sync o condivisione automatica; l'export richiede azione e destinazione scelte dalla persona. L'attestazione conserva solo istante, versione del testo e dichiarazione. Senza evidenza aziendale non si inventa un termine numerico di retention o una cancellazione automatica. La rimozione comprende tutti i dati e derivati controllati dall'app e segnala fallimenti/residui; copie esportate e backup esterni richiedono il processo aziendale. L'uso reale resta bloccato finché il gate policy del ticket 06 non è documentato.

## Criteri di accettazione tracciati

La formulazione dettagliata è nel [ticket «Definire esperienza e criteri di accettazione»](../.scratch/diario-di-lavoro/issues/04-definire-esperienza-e-criteri-di-accettazione.md). Tutte le prove sul Mac sono **da eseguire**.

| ID | Evidenza richiesta sulla build e sul Mac di destinazione | Origine |
| --- | --- | --- |
| AC1 | Preflight distingue monitor/scheda/finestra, tre flussi presenti/mancanti e classi d'errore osservabili. | Ticket 01, 04, 05 |
| AC2 | Suono di altra app e voce sono separati e riascoltabili nello stesso intervallo; esito e istante restano registrati. | Ticket 04, 05 |
| AC3 | Avvio, pausa, ripresa e conclusione producono tratti/timeline/lacune coerenti e comandi/stato visibili. | Ticket 03, 04, 07 |
| AC4 | Perdita di flusso ferma il tratto completo; il ridotto richiede opt-in ed è marcato in UI, dati ed export. | Ticket 04, 07 |
| AC5 | Dopo chiusura forzata, revoca, sleep e riavvio si recuperano/riproducono/esportano blocchi confermati; perdita misurata e lacune visibili. | Ticket 02, 04, 07 |
| AC6 | Quota/scrittura fallita ferma la cattura e conserva/esporta il confermato senza falso stato «salvato». | Ticket 02, 04, 07 |
| AC7 | ASR locale su italiano rappresentativo dà segmenti temporizzati ricercabili; accuratezza, ritardo e prestazioni misurati; errore ASR non perde audio. | Ticket 02, 04 |
| AC8 | Dopo download esplicito e cache verificata, registrazione, ASR, cronologia, ricerca, riproduzione ed export funzionano offline, senza invio automatico di contenuti. | Ticket 02, 04, 06 |
| AC9 | Registrazione continua di **almeno due ore** misura flussi, memoria, spazio, lag, integrità, ricerca ed export; durata maggiore se l'uso lo richiede. | Ticket 04, 05 |
| AC10 | Export integrale/parziale riapribile con manifest, flussi, intervalli, lacune e stato ASR coerenti con i blocchi reali. | Ticket 03, 04, 07 |

La consegna tecnica completa richiede esito e misure per ogni AC, sul Mac/profilo reali, con versioni e procedura. AC7 ha attualmente un pass riferito dall'utente, non una misura indipendente; gli altri stati sono nella [matrice AC](verification/acceptance-matrix-2026-09-22.md). Esiti falliti restano visibili e generano una decisione su correzione o perimetro; nessun criterio è «passato» per sola progettazione.
