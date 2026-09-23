Label: wayfinder:map
Status: open

# Trascrizione locale a due percorsi — mappa Wayfinder

## Destination

Una specifica di evoluzione pronta per revisione: trascrizione locale selezionabile tra tre livelli di qualità nel browser e un servizio ASR sullo stesso computer, con contratto, dati, esperienza e prove definiti per **macOS e Windows**. Questa mappa riguarda le decisioni; non autorizza implementazione, cambio branch o integrazione.

## Notes

- Mappa autonoma sul branch di pianificazione `feature/local-transcription-planning`. Il [piano candidato](spec.md) rende concrete le fasi e i criteri, subordinati alle prove dei ticket. Il precedente [Diario di lavoro](../diario-di-lavoro/map.md) e [la specifica storica](../../docs/spec.md) sono contesto, non una specifica da duplicare. La build attuale è media-only e conserva l'archivio nella cartella scelta dall'utente.
- **Fatti forniti dall'utente:** la persona sceglie il percorso; il browser offre tre livelli di qualità ASR JavaScript. Per il secondo percorso l'utente ha scelto **un motore ASR locale dedicato**, non LM Studio diretto, con **URL completo configurabile, porta e percorso**, verso un processo sullo **stesso computer** (loopback). L'intera evoluzione deve funzionare allo **stesso modo** su macOS e Windows: stessa UI, modalità, significato dei livelli, azione esplicita, vista, schema dati, ricerca ed export. Un clic esplicito avvia la trascrizione in entrambi i percorsi; per il server lo stesso gesto autorizza l'invio dell'audio, senza upload automatico. Le registrazioni possono essere solo audio oppure video con audio. Dal video si invia **soltanto la traccia audio estratta**. Microfono e audio del computer producono **due trascrizioni di sorgente distinte**, presentate in un'unica vista cronologica con etichette visibili.
- **Scelte tecniche provvisorie delegate al coordinamento:** usare un motore ASR dedicato su loopback con contratto audio documentato e URL completo configurabile. Preferire lo stesso modello multipiattaforma, per esempio whisper.cpp con checkpoint multilingue uguale e binari/backend specifici per OS da verificare; MLX da solo è limitato a macOS. Il server nativo whisper.cpp usa `/inference`; un adattatore può normalizzare i risultati senza cambiare motore. Conservare testo, stato e provenienza nella cartella archivio. Candidati browser **non selezionati**: Whisper multilingual base ONNX per rapidità, Small q8/WASM intermedio, large-v3-turbo ONNX/WebGPU opzionale per qualità. Ordinamento e fattibilità richiedono confronto degli **stessi modelli/runtime** sugli stessi clip italiani su entrambi gli OS; una precedente prova Small fp16/WebGPU ha prodotto testo vuoto. Nessun modello `.en` è adatto all'italiano. Queste sono ipotesi di progetto, non capacità verificate sui dispositivi target.
- **Evidenza ancora da acquisire:** modelli e backend JavaScript realmente utilizzabili ai tre livelli su macOS e Windows, tempi/memoria/qualità, permessi CORS e loopback sui due OS, protocollo del motore dedicato, limiti di dimensione e durata, conversione dei media esistenti, policy aziendale. La prova sul server Windows reale, dettagliata nel [ticket LM Studio](issues/07-verificare-lm-studio-diretto.md), non ha trovato la rotta ASR né un modello audio installato; Mac e audio italiano non sono stati testati. È contesto della scelta utente, **non un gate aperto**. La disponibilità di whisper.cpp non dimostra installazione o prestazioni sui dispositivi specifici. Il precedente resoconto favorevole sulla qualità ASR è superato dal giudizio più recente dell'utente, che la ritiene insufficiente: non vale come accettazione.
- **Vincoli della build corrente emersi dall'audit:** i frammenti media richiedono ricomposizione dal frammento con header (indice 0) prima della decodifica; i frammenti successivi non sono file autonomi. Un precedente upgrade elimina lo store IndexedDB delle trascrizioni legacy e la migrazione archivio non le include: il recupero storico richiede evidenza e può essere impossibile. Il service worker e le vecchie cache ASR vengono rimossi dalla build media-only. Nessuna di queste osservazioni certifica un esito sul Mac target.
- Le sessioni lavorano un ticket decisionale alla volta; `Blocked by` definisce il fronte. Le risposte delegate sono marcate come tali e distinte da prove documentali, prove locali e resoconti dell'utente. Prima dell'implementazione, il task principale presenta piano e specifica concreti e ottiene il consenso richiesto dal protocollo Wayfinder automatico. La validazione su **entrambi** gli OS e il gate delle policy aziendali restano separati.

## Decisions so far

- [Verificare LM Studio diretto come ASR locale](issues/07-verificare-lm-studio-diretto.md): il server Windows provato non espone ASR; l'utente ha scelto il motore locale dedicato, quindi LM Studio diretto esce dal perimetro corrente.

## Not yet specified

- Possibili adattatori aggiuntivi per server locali, solo dopo una prova di compatibilità del contratto scelto.
- Dettagli di installazione e distribuzione dell'eventuale helper sul Mac gestito, dopo che il contratto e le capacità del target saranno noti.

## Out of scope

- Trascrizione automatica durante cattura o all'apertura dell'archivio; invio a cloud, LAN o servizi remoti.
- Cambiare la cattura continua, il formato dell'archivio media o la politica di registrazione oltre a quanto serve per leggere l'audio senza perdita dei file sorgente.
- Ripristinare per presunzione trascrizioni storiche già eliminate: va prima accertata la presenza di una copia recuperabile.
- Implementazione, commit, cambio branch e pubblicazione in questa fase di pianificazione.
- Integrazione diretta con LM Studio o Ollama: il percorso scelto è il motore ASR locale dedicato; le prove precedenti restano come contesto.
