# Verifica trascrizione locale: Windows e macOS

Stato: prove parziali. Una casella vuota non equivale a un esito positivo. Usare soltanto registrazioni innocue e senza dati di terzi.

## Ambiente

| Campo | Windows | macOS |
| --- | --- | --- |
| Data e persona che ha eseguito la prova | Da compilare | Da compilare |
| Commit e branch | Da compilare | Da compilare |
| OS, CPU, RAM, GPU | Da compilare | Da compilare |
| Chrome e permessi effettivi | Da compilare | Da compilare |
| Motore ASR, versione, checkpoint e hash | Da compilare | Da compilare |
| URL completo del servizio su loopback | Da compilare | Da compilare |
| Origine effettiva della web app | Da compilare | Da compilare |

## Campioni di riferimento

Preparare, per entrambi i sistemi, gli stessi campioni italiani con testo umano verificato: voce chiara, rumore, pausa lunga, termini tecnici, due voci sovrapposte e audio del computer. Conservare il riferimento separatamente dal risultato ASR. Annotare durata, sorgente e consenso applicabile. Usare anche una cattura video con audio e una registrazione lunga con almeno tre frammenti consecutivi.

## Esiti per ogni combinazione

Compilare una riga per ogni livello browser e per il motore locale su **entrambi** gli OS. Indicare `pass`, `fail`, `bloccato` o `non eseguito`; non copiare un esito da un sistema all'altro.

| OS | Percorso/livello e modello | Clip e sorgente | Stato | Parole mancate/errate/inventate, WER/CER | Latenza e picco RAM | Copertura/timestamp | Evidenza |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Windows | Browser rapido · Whisper base q8/WASM | Clip CC0 0037 | Solo smoke clip breve | Testo italiano corrispondente al riferimento; benchmark rappresentativo aperto | Non misurata in modo ripetibile | Timestamp restituiti; precisione non valutata | Chrome headless, preparazione e reload offline dalla cache |
| Windows | Browser bilanciato · Whisper small q8/WASM | Clip CC0 0037 | Solo smoke clip breve | Testo italiano corrispondente al riferimento; benchmark rappresentativo aperto | Non misurata in modo ripetibile | Timestamp restituiti; precisione non valutata | Chrome headless, preparazione e reload offline dalla cache |
| Windows | Browser qualità massima · large-v3-turbo q4f16/WebGPU | Clip CC0 0037 | Smoke online e riapertura offline pass | Testo corrispondente al riferimento; qualità rappresentativa aperta | Con cartella modello: caricamento 33,85 s iniziale e 21,03 s offline, inferenza 2,36–2,38 s in Chrome headless | Timestamp restituiti; precisione non valutata | File in cartella OPFS di prova, rete esterna bloccata al secondo avvio; cartella scelta dall'utente ancora da provare |
| Windows | Motore locale | Da compilare | Solo smoke API | Due clip brevi esatte; prova completa aperta | 25,16 s per clip di 2,64 s su CPU | Un segmento temporizzato per clip | Vedere sotto |
| macOS | Browser rapido | Da compilare | Non eseguito | | | | |
| macOS | Browser bilanciato | Da compilare | Non eseguito | | | | |
| macOS | Browser qualità massima · large-v3-turbo q4f16/WebGPU | Clip CC0 0037 | Smoke online e riapertura offline pass sul runner con quota browser ampliata | Testo corrispondente al riferimento; qualità rappresentativa aperta | Con cartella OPFS di prova: caricamento 53,81 s iniziale e 32,62 s offline, inferenza 8,39–11,45 s | Timestamp restituiti; precisione non valutata | CI `35942551191`; OPFS senza quota ampliata fallisce, cartella scelta dall'utente e Chrome normale non verificati |
| macOS | Motore locale | Da compilare | Non eseguito | | | | |

## Prove di comportamento

| Verifica | Windows | macOS | Evidenza da conservare |
| --- | --- | --- | --- |
| Nessuna trascrizione o richiesta HTTP prima del clic | Smoke UI pass | Smoke UI CI pass | Traccia di rete e stato UI |
| URL completo, preflight, CORS e rifiuto di host/redirect non loopback | Test unitari e smoke preflight pass; UI errori aperta | Non eseguito | URL, risposta e messaggio UI |
| Payload al servizio contiene solo WAV audio, mai frame video | Test contratto pass; smoke video e POST separati, combinazione E2E video→helper aperta | Smoke UI su video sintetico pass; helper reale non eseguito | Tipo, dimensione e intestazione del file ricevuto |
| Microfono e audio computer restano due sorgenti in una vista cronologica | Smoke UI helper pass con due run/POST, test vista/export pass | Non eseguito | Segmenti con etichette e tempi, inclusa sovrapposizione |
| Media solo audio e video con audio, brevi e lunghi | Smoke Chrome breve entrambi formati pass; lungo aperto | Smoke Chrome CI breve entrambi formati pass; lungo aperto | ID registrazione, frammenti, intervalli |
| Nessun caricamento in RAM dell'intero video lungo | Non eseguito | Non eseguito | Profilo memoria durante il job |
| Download esplicito e secondo avvio offline del modello browser | Smoke Rapido/Bilanciato/Massima pass su clip breve | Massima pass solo in OPFS di prova con quota browser ampliata; Rapido/Bilanciato non eseguiti | Cache o cartella modello, stato rete, risultato |
| Annullamento, errore server, file mancante e retry | Test di dominio parziali; scenario reale aperto | Non eseguito | Stato run e media originale intatto |
| Doppio clic su Trascrivi e navigazione durante il job | Smoke UI/helper pass: un job, due POST per le due sorgenti; Ricerca resta aperta | Non eseguito | Numero di run, richieste e vista corrente |
| Ricerca, export, riapertura e delete preservano sorgente e provenienza | Test e smoke UI pass su fixture; riapertura reale aperta | Non eseguito | Manifest, file archivio e UI |

La cattura reale, i permessi macOS e le policy per audio aziendale sono gate distinti dalla riuscita dei test automatici. Registrare ogni limite o discrepanza nel ticket Wayfinder pertinente prima di dichiarare completata la funzionalità.

## Smoke API Windows del 24 settembre 2026

Sul PC Windows i7-8700, 16 GB RAM, RTX 2070, l'helper `local-asr/server.py` ha risposto su `http://127.0.0.1:8765/asr` con `whisper-cli` v1.9.2 e modello multilingue `ggml-large-v3-turbo-q5_0.bin`. Lo SHA-1 del modello era `e050f7970618a659205450ad97eb95a18d69c9ee`; lo ZIP Windows CPU ufficiale aveva SHA-256 `49dcc16de826f20bd53d44f947a1ae49dfa81f86cad67a64d80820cb192d674a`. I file sono stati installati fuori dal repository in `%LOCALAPPDATA%/diario-local-asr/`.

Due clip dal [dataset italiano CC0](https://huggingface.co/datasets/paolapersico1/Voice-Dataset-Italian) sono state convertite da WAV 48 kHz a PCM16 mono 16 kHz per la richiesta:

| Clip | Riferimento | Risposta helper | Intervallo | Risultato |
| --- | --- | --- | --- | --- |
| `4000000037.wav` | «Aspettiamo un po', perché a volte ci vuole un po' di tempo.» | Stesso testo | 0,00–2,40 s | Esatto sul riferimento |
| `4000000039.wav` | «Facciamo un'altra prova riavviando la macchina.» | Stesso testo | 0,00–2,46 s | Esatto sul riferimento; 25,16 s end-to-end per 2,64 s di audio |

Questo smoke conferma l'inferenza HTTP locale con due clip brevi. Non prova la qualità su parlato spontaneo o rumore, la pipeline browser/video, una sessione lunga o macOS.

La release CUDA v1.9.2 inizialmente riportava `no GPU found`. Dopo aver aggiunto localmente le DLL cuBLAS dal pacchetto NVIDIA `nvidia-cublas-cu11==11.11.3.6`, il log ha mostrato la RTX 2070 come backend CUDA e ha prodotto lo stesso testo esatto. Sul clip 0037 `whisper_print_timings` ha però misurato **49,28 s** totali contro **24,48 s** del binario CPU: su questo hardware la GPU non è una scelta prestazionale predefinita. L'asset CUDA ufficiale aveva SHA-256 `1776668730f5594a0b15f930225779e863dd8280397f9ee7c6e47ccf82bbb203`; il wheel NVIDIA aveva SHA-256 `6ab12b1302bef8ac1ff4414edd1c059e57f4833abef9151683fb8f4de25900be`. Entrambi restano fuori dal repository.
