Parent: ../map.md
Type: task
Status: resolved

# Definire vincoli aziendali di registrazione e conservazione

## Question

Quali regole effettive del Mac/ambiente aziendale autorizzano o limitano registrazione di schermo, audio di altre applicazioni e persone in call, conservazione locale, cancellazione ed export? Raccogliere o far riferire la policy applicabile senza inventarla, distinguendo fatti verificati da scelte delegate. Specificare quali requisiti d'uso restano condizionati a consenso/autorizzazione aziendale e quali impostazioni prudenti dell'app si possono fissare comunque. Non modificare policy, permessi gestiti o impostazioni di sicurezza per superare divieti.

## Answer

Decisioni progettuali **delegate dal coordinatore il 2026-09-21** in due giri di grilling (Q1–Q7). Non sono una policy aziendale, un parere legale né un'autorizzazione. Non è stata fornita o verificata alcuna regola aziendale, né il consenso/autorizzazione di altre persone. La frontiera delle scelte progettuali di questo ticket è vuota; il gate fattuale sotto resta aperto prima dell'uso reale.

### Defaults prudenti della prima versione

- La cattura è manuale e visibile. Prima di **ogni sessione con cattura** la persona rende una [attestazione di registrazione](../../../CONTEXT.md): dichiara di aver verificato le regole applicabili e di aver ottenuto preventivamente informazione, consenso e/o autorizzazione dove richiesti. Senza attestazione non si avvia la cattura. Si conservano solo istante, versione del testo attestato e dichiarazione della persona; non nomi di partecipanti né documenti sensibili di consenso. L'app non valida la dichiarazione e non sostituisce eventuali registri o procedure aziendali.
- Media, trascrizioni, note, metadati e indice restano locali per impostazione predefinita. Nessun upload, condivisione, sincronizzazione o destinazione cloud automatica; il download iniziale di un modello, se necessario, rimane azione esplicita e non invia contenuti. Nessun termine numerico di conservazione e nessuna cancellazione automatica arbitraria finché la regola effettiva non è nota.
- L'export richiede un gesto esplicito, la scelta di sessione intera o singolo tratto e un avviso su contenuti, lacune e uscita dal perimetro controllato dall'app. Non si assume che una destinazione locale o cloud sia autorizzata: percorso, condivisione e durata delle copie esportate dipendono dalle regole aziendali accertate.
- Rimuovere una sessione deve includere tutte le copie e i derivati controllati dall'app: blocchi media confermati o parziali, manifest, metadati, attestazione, note, eventi, originali ASR e versioni/correzioni ancora conservate, indice di ricerca, cache e dati di recupero pertinenti. La rimozione chiede conferma, rende visibili esito e residui/fallimenti e non dichiara successo parziale come completo. Export già salvati altrove, backup/snapshot gestiti da browser, sistema o azienda e cancellazione forense non sono sotto il controllo dell'app; l'avviso indica che vanno gestiti nel processo aziendale.
- Quando il periodo e le eccezioni applicabili saranno accertati, specificare scadenza, eventuale sospensione della cancellazione secondo processo aziendale, trattamento dei derivati e prova dell'eliminazione. Non inventare una durata né promettere cancellazione irreversibile. In caso di divieto o incertezza su un flusso o uso, non avviarlo e non ripiegare tacitamente su una modalità ridotta.

### Gate documentale prima dell'uso aziendale reale

Una persona autorizzata a interpretare la policy applicabile (da individuare dall'azienda; non si presume un referente specifico) o i documenti vigenti devono fornire per ogni riga **fonte/versione o referente, data, ambito, esito e azione**. Registrare anche eventuali condizioni, divieti e processo di revisione. Stato attuale di **tutte** le righe: `non verificato`.

| Ambito da accertare | Evidenza/domanda minima | Esito necessario prima dell'uso |
| --- | --- | --- |
| Schermo e app visibili | È consentita la cattura dell'intero monitor, anche di contenuti aziendali/terzi? Quali esclusioni? | Permesso esplicito per l'ambito effettivo; altrimenti niente cattura relativa. |
| Audio del computer e microfono | Sono consentiti l'audio di altre app, il microfono e la loro conservazione locale? | Permesso per ciascun flusso; divieto/incertezza blocca quel flusso. |
| Persone, riunioni e call | Quale informazione, consenso o autorizzazione è richiesta, da chi, prima di quando, e dove si documenta? Esistono divieti di piattaforma/riunione? | Processo applicato prima della singola cattura; attestazione nell'app non lo sostituisce. |
| Conservazione locale | Browser/profilo e disco aziendali consentono i dati? Quali categorie, durata, accessi, cifratura/backup o limiti gestiti? | Periodo e perimetro approvati, incluse trascrizioni e versioni; processo di scadenza definito. |
| Cancellazione | Quali termini, eccezioni/hold, responsabilità, verifica e trattamento di backup e copie esportate? | Procedura attuabile e verificabile, inclusi fallimenti e copie fuori app. |
| Export e trasferimenti | Quali formati, destinatari/destinazioni e canali sono permessi? È vietato esportare audio o testo di terzi? | Solo export consentiti nell'ambito effettivo, senza destinazione implicita. |

Finché queste evidenze mancano, **l'uso con dati aziendali reali o persone non è autorizzato da questa specifica**. Eventuali prove minime con materiale innocuo/sintetico richiedono comunque di rispettare le regole del dispositivo/ambiente; eliminare i dati di prova al termine. Se la policy vieta o non chiarisce un requisito essenziale, il prodotto non può essere dichiarato «cattura completa» per quel contesto. Non cambiare policy, permessi gestiti o impostazioni di sicurezza per aggirare un divieto.

Questo gate organizzativo è distinto dalla [prova tecnica sul Mac aziendale](05-verificare-mac-aziendale.md): versioni, permessi utente e campioni di schermo/audio/microfono dimostrano capacità tecnica, **non** liceità o autorizzazione. Prima della consegna per uso reale servono entrambi gli esiti, più prove osservabili della rimozione e dell'export secondo le regole ottenute. Implementazione e test avvengono soltanto dopo il gate di approvazione esplicita dell'utente indicato nella [mappa](../map.md).
