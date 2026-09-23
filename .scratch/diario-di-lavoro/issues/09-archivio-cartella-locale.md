Parent: ../map.md
Type: implementation
Status: in progress

# Archivio in cartella locale obbligatoria

## Decisione

La build non usa IndexedDB, OPFS, Cache Storage o altra persistenza browser per sessioni, media, metadati, note, eventi, lacune o log. All'avvio richiede una cartella scelta con gesto dell'utente; senza un `FileSystemDirectoryHandle` con permessi di lettura/scrittura la UI resta bloccata. Nel browser può restare soltanto il handle necessario a ricollegare la cartella.

## Modulo e struttura

Il seam è il modulo profondo `FileArchive`. La sua interfaccia per UI e test deve rimanere piccola: aprire/verificare l'archivio, leggere lo snapshot di metadati, salvare un record, scrivere/leggere un frammento, eliminare una sessione e migrare una copia legacy. L'implementazione nasconde handle, permessi, gerarchia di file, journal, verifica dopo `close()`, recupero e adapter in memoria per i test.

Struttura prevista nella cartella scelta:

```
diario-di-lavoro/
  archive.json                 # snapshot dei metadati
  journal.json                 # operazioni recuperabili
  sessions/<session-id>/
    media/<recording-id>/<stream>/<index>.<estensione>
```

Ogni Blob `dataavailable` viene scritto e chiuso prima di essere segnato `salvato`; il journal e lo snapshot registrano path, ordine, intervallo, MIME e byte. Il recorder resta continuo: nessuno stop/start tra frammenti. Playback ed export ricompongono o leggono i frammenti dalla cartella, senza caricarli tutti in RAM.

## Criteri di accettazione

1. Senza cartella, handle non disponibile o permesso negato, nessuna sessione, cattura, export o dato esistente è consultabile; la schermata offre solo scegli/ripristina cartella.
2. Un handle già scelto viene riusato solo dopo verifica `readwrite`; se fallisce non c'è fallback silenzioso.
3. Nuovi record, metadati, note, eventi, lacune, journal e media sono file nella cartella. Un write media attende `close()` e verifica byte/riapertura prima dello stato `salvato`.
4. Per ogni registrazione/flusso i frammenti restano ordinati e separati. Crash o chiusura tra write, journal e snapshot non inventano continuità; all'apertura si recuperano i record journal verificabili e si dichiarano file mancanti.
5. Migrazione guidata legge la copia IndexedDB legacy, scrive e riapre ogni file nella cartella, è idempotente, conserva i Blob `non verificabile`, e cancella la copia browser solo dopo verifica completa. Se interrotta può riprendere senza cancellare l'origine.
6. Test con adapter in memoria coprono gate, permesso revocato, write/riapertura, quota/errore, journal dopo crash e migrazione ripetuta. Una prova browser Windows con dati sintetici è distinta dalla verifica reale Mac/Windows.

## Limiti da non nascondere

Il picker richiede gesto utente e i permessi/policy restano dipendenti da Chrome e dal dispositivo. La prova di cattura, riproduzione e recupero su Mac e Windows non è implicata dai test automatici o dall'adapter in memoria.
