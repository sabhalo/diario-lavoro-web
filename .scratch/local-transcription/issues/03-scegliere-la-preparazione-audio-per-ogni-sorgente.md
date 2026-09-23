Parent: ../map.md
Type: research
Status: open

# Scegliere la preparazione audio per ogni sorgente

## Question

Come si ricava, senza inviare video, audio ASR separato per microfono e audio del computer dalle registrazioni solo audio e video con audio, rispettando timestamp, lacune, codec e integrità dell'archivio? Conviene generare nuovi flussi audio autonomi durante la cattura oppure estrarre dai media archiviati, e come si trattano le registrazioni legacy?

La decisione deve considerare che i frammenti `MediaRecorder` successivi all'indice 0 non si decodificano isolatamente: serve ricomporre la sequenza per flusso prima di leggere la traccia. Evitare di caricare ore di video in RAM; specificare limiti, streaming/chunking, fallimenti parziali e prova che la richiesta di rete contenga solo audio. La preparazione non deve alterare o cancellare il media originale.
