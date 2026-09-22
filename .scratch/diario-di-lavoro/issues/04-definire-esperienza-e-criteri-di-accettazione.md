Parent: ../map.md
Type: grilling
Status: resolved
Blocked by: 01, 02, 03

# Definire esperienza e criteri di accettazione

## Question

Alla luce delle capacità verificate e del linguaggio di dominio, quale comportamento visibile rende la prima versione completa? Definire avvio/arresto, indicazione dei flussi attivi, controllo prima della registrazione, pause/interruzioni, salvataggio e recupero, ricerca, riproduzione ed export. Specificare i messaggi per capacità assenti o permessi negati e distinguere chiaramente la modalità completa dalle alternative parziali.

## Answer

Decisioni delegate dal coordinatore il 2026-09-21, tramite tre giri di grilling (Q1–Q11). Sono requisiti di esperienza e criteri proposti, **non prove sul Mac aziendale**. La base documentale prudente resta Chrome 142+ su macOS 14.2+, soggetta a permessi, policy e verifica dei campioni reali; vedere [ricerca cattura](../research/cattura-chrome-macos.md) e [ricerca trascrizione/persistenza](../research/trascrizione-persistenza-browser.md). Nessun codice prodotto viene avviato prima dell'approvazione esplicita dell'utente indicata nella mappa.

### Percorso visibile della prima versione

1. La persona apre una sessione esistente o avvia una nuova cattura manualmente. Se non c'è una sessione, l'app ne crea una con titolo provvisorio rinominabile. Mostra sempre sessione, tratto corrente, stato di salvataggio e pulsante di arresto.
2. Prima del tratto in modalità **cattura completa**, l'app chiede all'utente di scegliere un monitor/schermo intero e di autorizzare audio del computer e microfono. Verifica `displaySurface === "monitor"`, la presenza e lo stato delle tracce separate; mostra istruzioni specifiche se mancano versione, scelta, permessi del sito/macOS o se una policy blocca la cattura, senza promettere di poter modificare policy. La pagina non deve dedurre da `audio: true` che l'audio sia disponibile.
3. Una prova guidata usa un suono innocuo da un'altra applicazione e una breve voce al microfono, con livelli separati e riascolto locale confermato dalla persona; conserva esito e momento della prova. Non usare una call reale come test. Solo una prova positiva abilita l'etichetta **«cattura completa verificata»**. Se le tracce sono live ma le sorgenti tacciono, la persona può iniziare dopo informazione esplicita con stato persistente **«segnale non verificato»**. Se la verifica non riesce, il risultato rimane non verificato/limitato. Il silenzio naturale dopo una prova positiva non equivale da solo a perdita del flusso.
4. Una modalità ridotta è disponibile solo con scelta esplicita. Interfaccia, cronologia ed export la chiamano **«modalità ridotta»** e specificano i flussi assenti; non la presentano come equivalente al requisito completo. Nessun passaggio automatico dalla modalità completa a quella ridotta.
5. **Pausa** conclude il tratto corrente; **Riprendi** crea un nuovo tratto nella stessa sessione e richiede nuova scelta/permessi. **Concludi sessione** termina l'episodio logico e lo rende consultabile. Un'interruzione mostra causa nota o sconosciuta e intervallo non acquisito, senza fondere i tratti. Alla riapertura l'utente sceglie se riprendere la sessione interrotta o iniziarne una nuova.
6. Se monitor, audio del computer o microfono richiesto terminano o sono revocati durante la modalità completa, l'app arresta il tratto, tenta di confermare i dati già scritti, identifica il flusso perso e offre un nuovo tentativo completo o un nuovo tratto ridotto con opt-in. Se quota o scrittura falliscono, ferma la cattura, conserva ciò che è confermato e offre esportazione del recuperabile. Non rappresenta dati assenti come registrati.
7. La cattura audiovisiva può iniziare anche se il modello ASR non è pronto, purché il preflight di archiviazione riesca. Il testo appare **«trascrizione in attesa»** o **«incompleta»** con causa e retry locale; l'audio già confermato resta recuperabile. Il primo download di codice/modello viene dichiarato e avviato solo su azione esplicita; nessun audio o testo è inviato automaticamente all'esterno. Dopo preparazione e verifica della cache, registrazione, rielaborazione ASR, cronologia, ricerca, riproduzione ed export devono funzionare senza rete.
8. La cronologia mostra sessioni, tratti, eventi e lacune; la ricerca usa titolo, note, eventi e segmenti trascritti e apre il punto pertinente. La persona riproduce i tratti disponibili e può esportare l'intera sessione o un singolo tratto, con video/audio e testo con timestamp. Ogni export dichiara ambito, modalità, flussi presenti, lacune e stato di trascrizione; riassunti e valutazioni automatiche restano fuori dalla prima versione.

### Criteri di accettazione osservabili

| ID | Prova e risultato richiesto |
| --- | --- |
| AC1 | Sul Chrome/macOS di destinazione, il preflight distingue monitor da scheda/finestra, tre flussi presenti da mancanti e permesso negato da errore tecnico dove l'API lo consente. Non dichiara compatibilità sulla sola base di versione o opzioni richieste. |
| AC2 | Il suono proveniente da un'altra app e la voce del microfono producono campioni separati e riascoltabili nella prova guidata. Una traccia assente o silenziosa non supera la verifica audio; stato e timestamp restano consultabili. |
| AC3 | Avvio, pausa, ripresa e fine sessione producono tratti distinti nella stessa sessione, con linee temporali e lacune coerenti. Il controllo di stop e gli indicatori di cattura/salvataggio sono visibili durante il lavoro. |
| AC4 | Un flusso richiesto terminato ferma il tratto completo; eventuale nuovo tratto ridotto richiede consenso esplicito ed è marcato in UI, dati ed export. La perdita non viene scambiata per semplice silenzio. |
| AC5 | Dopo chiusura forzata, revoca, sospensione e riavvio vengono recuperati e riprodotti/esportati tutti i blocchi già confermati; gli intervalli non recuperabili sono indicati. Si misura la perdita, senza promessa di perdita zero dopo crash o sleep. |
| AC6 | Quota o errore di scrittura producono arresto chiaro e conservazione/esportazione dei blocchi confermati, senza indicatore falso di salvataggio riuscito. |
| AC7 | Su audio italiano rappresentativo, la trascrizione locale produce segmenti temporizzati ricercabili con salto/riproduzione del punto; ritardo, accuratezza e prestazioni sono misurati sul Mac target. Fallimento ASR lascia audio recuperabile e stato testuale corretto. |
| AC8 | Dopo download esplicito e verifica disponibilità offline, registrazione, rielaborazione ASR, cronologia/ricerca, riproduzione ed export funzionano con rete disattivata. Nessun invio automatico di audio/testo a servizi esterni. |
| AC9 | Una registrazione continua di **almeno due ore** sul Chrome/macOS target controlla continuità dei flussi, memoria, spazio, lag ASR, integrità dei blocchi, ricerca ed export. Una prova più lunga è necessaria se l'uso reale lo richiede. |
| AC10 | Export integrale e parziale dichiarano sessione/tratto, intervalli, flussi, lacune e trascrizione incompleta; video/audio si riaprono e testo/timestamp corrispondono ai blocchi disponibili. |

Questi criteri definiscono cosa va dimostrato. AC1–AC2 hanno una prova breve positiva **riferita dall'utente**; AC7 è superato **solo secondo testimonianza utente** del 2026-09-22 («decisamente molto, molto meglio» e per ora adeguata). Nessuna di queste testimonianze fornisce metriche, versione Chrome o, per AC7, profilo/modello effettivo; non sostituisce le prove restanti sul Mac. Il [ticket sul Mac aziendale](05-verificare-mac-aziendale.md) resta aperto per gli AC non verificati e non è sostituito da questa specifica. La matrice corrente è in [docs/verification](../../../docs/verification/acceptance-matrix-2026-09-22.md).

Le domande diventate formulabili dalla nebbia sono [Definire vincoli aziendali di registrazione e conservazione](06-definire-privacy-e-conservazione-aziendale.md) e [Definire modello dati e ricerca locale](07-definire-modello-dati-e-ricerca.md); sono state create come ticket distinti, non risolte qui.
