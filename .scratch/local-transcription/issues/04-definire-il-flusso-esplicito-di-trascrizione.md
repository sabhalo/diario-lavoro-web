Parent: ../map.md
Type: grilling
Status: open
Blocked by: 01, 02, 03

# Definire il flusso esplicito di trascrizione

## Question

Quale sequenza di scelta del percorso, livello browser o URL locale, selezione dei flussi, verifica compatibilità, avvio esplicito, avanzamento, annullamento e retry rende chiaro cosa verrà elaborato o inviato? Come si mostra una vista cronologica unica con due trascrizioni separate ed etichette `microfono` e `audio del computer`, anche in caso di lacune o esito di un solo flusso?

La decisione deve fissare stati e copy essenziali, senza aggiungere conferme ridondanti alla cattura media-only. L'azione ASR server deve rendere visibile che parte soltanto audio verso il loopback scelto. Non presumere che un URL configurato sia compatibile prima del capability check e della prova di richiesta.
