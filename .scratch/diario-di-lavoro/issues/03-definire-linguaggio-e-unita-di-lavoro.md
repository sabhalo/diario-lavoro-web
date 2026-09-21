Parent: ../map.md
Type: grilling
Status: resolved

# Definire linguaggio e unità di lavoro

## Question

Nel dominio di Diario di lavoro, che cosa sono precisamente «sessione di lavoro», «registrazione», «trascrizione», «evento», «cronologia» e «evoluzione personale»? Una call interrotta e ripresa è una o due sessioni? Come si correlano più flussi audio, video e testo? Quale unità è cercabile ed esportabile? Porre la frontiera di domande al coordinatore, cui l'utente ha delegato le risposte, e aggiornare `CONTEXT.md` appena i termini sono risolti.

## Answer

Scelte delegate dal coordinatore il 2026-09-21, dopo tre giri di domande e conferma esplicita che la frontiera del modello è vuota. Sono **decisioni di dominio**, non risultati di prove sul Mac. Il glossario canonico è in [CONTEXT.md](../../../CONTEXT.md).

- **Sessione di lavoro**: episodio intenzionale e nominabile, anche senza cattura, che contiene note, eventi e zero o più registrazioni. Al primo avvio di cattura senza sessione, se ne crea una con titolo provvisorio locale e rinominabile. Stop e ripresa non creano automaticamente una nuova sessione.
- **Registrazione**: un tratto continuo di cattura con inizio, fine e stato. Tratti prima e dopo uno stop o un'interruzione sono registrazioni distinte nella stessa sessione, se la persona sceglie di riprenderla.
- **Flussi**: schermo, audio del computer e microfono sono componenti distinti della registrazione sulla stessa linea temporale, ciascuno con presenza, intervalli effettivi e lacune. La perdita di un flusso richiesto fa decadere subito lo stato «completa» e va segnalata. Arresto oppure proseguimento esplicito in modalità ridotta è decisione del ticket [Definire esperienza e criteri di accettazione](04-definire-esperienza-e-criteri-di-accettazione.md).
- **Interruzione**: revoca, chiusura o sospensione osservabile chiude/interrompe il tratto corrente, con causa nota o sconosciuta e intervallo non acquisito; non conclude da sola la sessione. Alla riapertura la persona sceglie se riprendere quella sessione o crearne una nuova, senza soglie temporali o fusioni automatiche. Nessun dato è inventato per la lacuna.
- **Trascrizione**: insieme ordinato, anche incompleto, di segmenti temporizzati di una sessione, legati alle registrazioni e alla sorgente o al mix da cui derivano. Copertura, lacune, stato e provenienza restano riconoscibili. Il testo riconosciuto originale e le correzioni manuali restano distinguibili; nessuna attribuzione di parlante non verificata. Una sessione senza cattura può non avere trascrizione.
- **Evento**: fatto temporale nella sessione, inserito dalla persona oppure osservato dall'app con origine e tipo distinti. Una **nota** libera può essere una riflessione senza istante puntuale; un segmento trascritto non è un evento.
- **Cronologia**: ordine consultabile di sessioni ed eventi fattuali. **Evoluzione personale**: rilettura nel tempo di attività e progressi tramite note e riferimenti scelti dalla persona; nella prima versione non implica punteggi, valutazioni o inferenze automatiche.
- **Ricerca ed esportazione**: la sessione è il risultato principale della ricerca (titolo, note, eventi, parole della trascrizione), con salto al punto pertinente, ed è l'unità canonica di export. Il singolo tratto e il relativo testo sono unità secondarie esportabili. L'export parziale dichiara ambito e intervallo; quello integrale include metadati, registrazioni, testo, eventi, note, lacune e stato della trascrizione, senza fingere continuità nei periodi mancanti.
