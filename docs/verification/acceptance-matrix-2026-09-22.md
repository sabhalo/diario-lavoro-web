# Matrice AC e gate — stato delle evidenze, 2026-09-22

> **Matrice storica della variante ASR rimossa.** AC7 e le parti ASR di AC8/AC10 non sono criteri della build pubblica corrente. Non usare questa matrice per avviare o dichiarare verificata la build solo video/audio; seguire il [ticket 08](../../.scratch/diario-di-lavoro/issues/08-solo-media-e-cattura-continua.md).

## Regola di lettura

Gli stati non sono intercambiabili. **Implementato/localmente verificato** significa soltanto build o test sintetici osservati su Windows. **Mac verificato dall'utente** è un resoconto dell'utente sulla build target, non un'osservazione dell'agente; non implica metriche, versione o profilo non riportati. **Non verificato** non è un fallimento del prodotto: la prova non è disponibile.

| AC | Stato esatto | Evidenza e limite | Gate/prova minima ancora necessaria |
| --- | --- | --- | --- |
| AC1 | Mac verificato dall'utente, **solo preflight breve** | L'utente ha riferito monitor intero e i tre flussi; `displaySurface`, Chrome, policy e stati traccia non sono disponibili. | Sulla build: monitor/scheda/finestra, flussi e classi d'errore; annotare solo osservabili. |
| AC2 | Mac verificato dall'utente, **solo preflight breve** | L'utente ha riferito riascolti separati di audio altra app e microfono; nessun campione o livello è stato acquisito dall'agente. | Sulla build, ripetere i due campioni sintetici separati nello stesso intervallo e registrare esito/istante. |
| AC3 | Implementato/localmente verificato | Test Node e UI Windows hanno coperto transizioni/timeline; non è Mac. | Eseguire avvio, pausa, ripresa e fine su Mac con dati sintetici e confrontare tratti/lacune/UI. |
| AC4 | Implementato/localmente verificato | Il comportamento è coperto localmente; perdita reale di traccia non è stata provocata su Mac. | Su Mac terminare un flusso durante cattura sintetica; confermare stop, blocchi e opt-in ridotto. |
| AC5 | Implementato/localmente verificato, recupero Mac non verificato | Sono presenti test sintetici; nessuna chiusura forzata, revoca o sleep della build su Mac. | Con dati sintetici e sessioni separate: chiusura forzata, revoca, sleep/riapertura; riprodurre ed esportare il confermato, misurare lacune. |
| AC6 | Implementato/localmente verificato, quota Mac non verificata | Logica/test locali non stabiliscono quota o scrittura sul profilo target. | Prima verificare spazio/quota in modo non distruttivo; simulare errore di scrittura oppure usare un budget di test consentito, poi confermare stop e export del confermato. Non riempire il disco. |
| AC7 | Mac verificato dall'utente — **superato secondo testimonianza utente** | Esito più recente riferito: trascrizione «decisamente molto, molto meglio» e per ora adeguata. Profilo/modello, Chrome, metriche, testo, timestamp, benchmark e osservazione indipendente: **sconosciuti/non forniti**. | Per trasformarlo in prova misurata, usare una frase italiana innocua e riportare solo profilo effettivamente scelto, testo, segmenti/timestamp, durata, tempo totale e limite. Non necessario per registrare il pass riferito. |
| AC8 | Implementato/localmente verificato, offline Mac non verificato | Download/preparazione e test locali non dimostrano cache né assenza di invio sul Mac. | Dopo cache esplicita, disattivare la rete e, con dati sintetici, verificare registrazione, ASR, cronologia/ricerca, riproduzione ed export; annotare esiti e richieste di rete osservate. |
| AC9 | Non verificato | Nessuna cattura continua di almeno due ore sul Mac. | Eseguire una sessione ≥2 h con i tre flussi sintetici autorizzati; annotare inizio/fine, continuità, spazio, memoria/reattività, lag ASR, blocchi, ricerca ed export. Se un flusso non è consentito, registrare la prova come parziale. |
| AC10 | Implementato/localmente verificato, export Mac non verificato | ZIP/export sintetico locale e ZIP64 sono stati controllati; nessun export della build è stato riaperto sul Mac. | Esportare una sessione sintetica intera e un tratto; riaprire sul Mac e confrontare manifest, media, testo, intervalli, flussi, lacune e ASR. |

## Gate policy separato

**Stato: non verificato e chiuso all'uso reale.** Nessuna policy aziendale, consenso, retention, cancellazione o autorizzazione di export è stata fornita o inferita. Prima di acquisire dati aziendali reali o persone, una fonte autorizzata deve attestare per l'ambito effettivo: cattura schermo, ciascun flusso audio, persone/call, conservazione locale, cancellazione e destinazioni/export. Registrare fonte/versione o referente, data, ambito, esito e condizioni. I test sopra restano esclusivamente sintetici e non modificano policy, permessi gestiti, flag, estensioni o driver.

Il requisito tecnico completo rimane aperto finché gli AC non completati sul Mac non hanno evidenza pertinente. Il pass riferito di AC7 non autorizza uso reale e non colma AC1–AC6, AC8–AC10.
