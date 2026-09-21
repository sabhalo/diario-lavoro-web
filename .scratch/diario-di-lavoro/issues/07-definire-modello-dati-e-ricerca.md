Parent: ../map.md
Type: grilling
Status: resolved
Blocked by: 04

# Definire modello dati e ricerca locale

## Question

Quali dati persistenti, stati e riferimenti temporali collegano sessioni, registrazioni, flussi, blocchi confermati, segmenti di trascrizione, eventi, note e lacune in modo da consentire recupero, ricerca e export senza inventare continuità? Scegliere l'unità dell'indice testuale e le regole per aggiornare ricerca e trascrizione corretta; conservare provenienza e ambito degli export. Separare decisioni di dominio dalla scelta tecnica concreta di OPFS/IndexedDB, da validare nell'implementazione e sul Mac target.

## Answer

Scelte **delegate dal coordinatore il 2026-09-21** in due giri di grilling (Q1–Q8). Sono invarianti di dominio e requisiti di dati per la prima versione, non prove sul Mac. Il [glossario canonico](../../../CONTEXT.md) definisce i termini; i [criteri di accettazione](04-definire-esperienza-e-criteri-di-accettazione.md) definiscono le verifiche visibili. La frontiera decisionale di questo ticket è vuota.

### Entità, identità e stato

| Entità | Legame e dati persistenti minimi |
| --- | --- |
| Sessione | ID stabile, titolo modificabile, inizio/fine assoluti se noti, zona oraria, stato `aperta`, `interrotta/in attesa di scelta` o `conclusa`. Contiene zero o più registrazioni, note ed eventi; è valida anche senza cattura. |
| Registrazione | ID stabile, ID sessione, inizio/fine assoluti e offset nella sessione, stato `preparazione`, `in corso`, `terminata` o `interrotta`, causa nota/sconosciuta, modalità richiesta/effettiva e verifica dei flussi con esito e tempo. Pausa chiude il tratto; ripresa ne crea uno nuovo. |
| Flusso | ID stabile, ID registrazione, tipo schermo/audio del computer/microfono, intervalli di presenza e stato effettivo. La perdita di un flusso richiesto genera un evento e termina il tratto completo; il silenzio da solo non equivale a perdita. |
| Blocco di cattura | ID stabile, ID registrazione, ordine esplicito, intervallo, riferimenti ai flussi **effettivamente contenuti**, formato, dati di validazione e stato di scrittura/conferma/verifica. |
| Segmento di trascrizione | ID stabile, ID registrazione, sorgente flusso/mix, intervallo e blocchi sorgente, testo ASR originale, correzioni/versioni, stato e provenienza dell'elaborazione. |
| Evento e nota | ID stabili e ID sessione; evento con tipo, origine persona/app e istante/intervallo; nota con testo libero e tempo di creazione/modifica, senza obbligo di un punto nella timeline. |
| Lacuna | ID stabile, ID sessione e registrazione se pertinente, intervallo noto o confini incerti, flusso/contenuto coinvolto, causa nota/sconosciuta e origine dell'accertamento. Non rappresenta media acquisiti. |

Ogni relazione usa un riferimento esplicito a un ID. Legami, disponibilità media e stato di verifica non si inferiscono da nomi dei file, ordine implicito o semplice presenza. Le referenze restano integre durante recupero, modifica e rimozione secondo le regole del [ticket privacy e conservazione](06-definire-privacy-e-conservazione-aziendale.md).

### Tempo e lacune

- Sessioni e registrazioni conservano istanti assoluti per cronologia e visualizzazione, con zona oraria esplicita. Intervalli di blocchi, flussi, segmenti e lacune sono `[inizio, fine)` sulla timeline della sessione; gli eventi possono essere puntuali. Per ogni tratto si conserva la mappatura fra timestamp originali di cattura, offset del tratto e timeline della sessione.
- Cambio di clock e sospensione non trasformano il tempo trascorso in media registrato. Durata e posizione derivano dagli istanti di cattura verificati, non dal conteggio dei Blob o da `timeslice`. Un confine non misurabile resta ignoto o lacuna con confini incerti; tratti separati non sono cuciti.
- La modalità completa verificata, completa con segnale non verificato e ridotta sono attributi persistenti della registrazione; ogni cambiamento consentito ha un evento temporizzato. La modalità ridotta richiede la scelta esplicita della persona e non emerge automaticamente dalla perdita di un flusso.

### Conferma e recupero

- Un blocco passa da `in scrittura` a `confermato` solo dopo scrittura completata e metadati/manifest coerenti. Il checkpoint avanza soltanto su contenuto **verificabile e riproducibile**. Stato `mancante/non verificabile` non equivale a conferma. Il buffer ancora in memoria non è promesso come recuperabile.
- Alla riapertura si riconciliano manifest e contenuti reali; soltanto blocchi validati sono presentati come recuperabili, riproducibili ed esportabili. Gli altri producono lacuna o stato incerto. Dopo crash la sessione è `interrotta/in attesa di scelta`; la persona decide se riprenderla con un nuovo tratto.
- Non si presume transazione atomica tra archivi media e metadati né durabilità garantita dopo spegnimento improvviso. Formato, dimensione, commit e riproducibilità dei singoli blocchi richiedono [prove sul Mac target](05-verificare-mac-aziendale.md). OPFS e IndexedDB restano opzioni tecniche candidate, non contratto di dominio.

### Trascrizione e ricerca

- Stato ASR indipendente dalla cattura: `in attesa`, `in elaborazione`, `parziale`, `completa` o `errore`, con causa, copertura e retry locale. Ogni segmento conserva motore, modello/versione, esito e tempo di elaborazione, intervallo e sorgente; nessun parlante è attribuito senza verifica.
- Testo ASR originale immutabile. Correzioni manuali versionate con tempo e autore locale; rielaborazione come nuova versione e scelta esplicita della versione attiva. Nella prima versione si conservano originale, versione attiva e cronologia delle correzioni. Ulteriori versioni ASR seguono regole di conservazione e cancellazione del ticket 06, senza promessa di storia illimitata.
- La sessione è il risultato principale della ricerca locale. Ogni hit conserva sorgente (titolo, nota, evento, segmento), snippet, timestamp se esiste, stato testuale e destinazione del salto. Nota senza istante apre la sessione. Filtri data e sessione sono nella prima versione; filtro tipo/sorgente se semplice e senza penalizzare la ricerca primaria.
- L'unità indicizzata è il documento sorgente: titolo di sessione, singola nota, singolo evento o singolo segmento. Il testo corrente cercabile è la correzione attiva se presente, altrimenti l'ASR originale; l'originale è cercabile con filtro esplicito. Modifica, nuova versione attiva e rimozione aggiornano l'indice prima che la ricerca sia mostrata come aggiornata. Risultati parziali dichiarano copertura incompleta. Strategia tecnica e prestazioni dell'indice dipendono da misure di volume.

### Export

- Export di sessione intera o singola registrazione con manifest strutturato versionato e file media/testo separati. Il manifest dichiara ID e titolo della sessione, ambito/intervalli, registrazioni incluse e sessione madre per export parziale, modalità/verifica, flussi effettivi, blocchi disponibili, lacune/confini incerti, eventi/note pertinenti, stato/copertura/provenienza ASR e contenuti mancanti.
- L'export ordinario leggibile usa testo finale attivo con timestamp e provenienza essenziale. Archivio completo opzionale include originale ASR e cronologia di correzioni/versioni ancora conservate, con avviso della sensibilità dei dati. Il singolo tratto include solo dati del suo ambito e le lacune pertinenti.
- Nessun indice o export dichiara disponibile media oltre il checkpoint verificato. Segmenti da media poi non recuperabile restano marcati `sorgente non verificabile`; il manifest dichiara la discrepanza. La prova sul target deve riaprire i file esportati dopo chiusura riuscita.

Restano aperte la prova reale di cattura, formato, recupero e prestazioni sul Mac (ticket 05), le regole aziendali di conservazione/rimozione (ticket 06) e la scelta concreta di storage e indice durante l'implementazione dopo l'approvazione dell'utente.
