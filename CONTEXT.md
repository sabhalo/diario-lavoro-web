# Diario di lavoro

Linguaggio condiviso per descrivere il lavoro ricordato e consultato nel Diario di lavoro.

## Language

**Sessione di lavoro**:
Episodio intenzionale di lavoro, nominabile dalla persona. Può contenere più tratti registrati, note ed eventi, oppure esistere senza cattura.
_Avoid_: Registrazione, call

**Registrazione**:
Tratto continuo di cattura con un proprio inizio, una fine e uno stato, appartenente a una sessione di lavoro. Una ripresa dopo un arresto o un'interruzione è una nuova registrazione.
_Avoid_: Sessione di lavoro

**Flusso**:
Componente di schermo, audio del computer o microfono di una registrazione, con presenza e intervalli effettivi sulla sua linea temporale. L'assenza o la perdita di un flusso richiesto rende incompleta la registrazione.
_Avoid_: Registrazione

**Blocco confermato**:
Porzione di cattura di una registrazione la cui scrittura è completata e il cui contenuto è stato verificato come recuperabile e riproducibile. La sua conferma non implica che gli intervalli adiacenti siano stati acquisiti.
_Avoid_: Buffer in memoria, registrazione completa

**Lacuna**:
Intervallo di una sessione o registrazione per cui la cattura o la trascrizione manca, è incerta o non è recuperabile, con confini e causa dichiarati per quanto noti. Non rappresenta contenuto acquisito.
_Avoid_: Pausa registrata, silenzio

**Evento**:
Fatto collocato nel tempo di una sessione di lavoro, inserito dalla persona o osservato dall'app, con origine e tipo distinguibili. Non è un segmento di trascrizione.
_Avoid_: Segmento di trascrizione

**Nota**:
Testo libero della persona associato a una sessione di lavoro; può contenere una riflessione senza riferirsi a un fatto puntuale nel tempo.
_Avoid_: Evento, segmento di trascrizione

**Interruzione**:
Fine non intenzionale di una registrazione, con causa nota o sconosciuta e un intervallo successivo non acquisito. Non conclude da sola la sessione di lavoro.
_Avoid_: Fine della sessione

**Segmento di trascrizione**:
Porzione di testo riconosciuto associata a un intervallo temporale e alla registrazione da cui deriva. Un'eventuale correzione della persona resta distinta dal testo riconosciuto originale.
_Avoid_: Evento, nota

**Trascrizione**:
Insieme ordinato, anche incompleto, dei segmenti temporizzati di una sessione di lavoro, con copertura, lacune e provenienza riconoscibili. Una sessione senza cattura può non averne una.
_Avoid_: Nota, cronologia

**Cronologia**:
Vista ordinata nel tempo delle sessioni di lavoro e dei loro eventi fattuali.
_Avoid_: Evoluzione personale

**Evoluzione personale**:
Rilettura nel tempo delle attività e dei progressi attraverso note e riferimenti scelti dalla persona. Non è una valutazione o un punteggio automatico.
_Avoid_: Cronologia, punteggio
