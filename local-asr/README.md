# Motore ASR locale per Diario di lavoro

Questo adattatore usa Python 3.10+ (solo libreria standard) e `whisper-cli` di whisper.cpp. Ascolta soltanto su loopback. Il browser gli invia esclusivamente WAV mono PCM16 a 16 kHz dopo l'azione esplicita **Trascrivi**. L'adattatore non scarica modelli, non avvia la cattura, non riceve video e cancella il WAV derivato e il JSON temporaneo al termine del job. Non richiede `ffmpeg`: l'app prepara il WAV.

## Ottenere il motore e il modello

I comandi seguenti sono **istruzioni di installazione**, non eseguiti automaticamente. Per mantenere uguale il contratto sui due sistemi usare whisper.cpp **v1.9.2** e lo stesso checkpoint GGML multilingue **large-v3-turbo-q5_0**. Il checkpoint è un candidato di qualità da confrontare su clip italiani; non è ancora un'accettazione su Windows o Mac. È circa **547 MiB** su disco e il download è volontario. Non scegliere un modello `.en`, che non supporta l'italiano. `small` (466 MiB) è soltanto un possibile smoke test: una prova precedente è stata giudicata insufficiente per il prodotto.

La [tabella ufficiale dei modelli](https://github.com/ggml-org/whisper.cpp/blob/master/models/README.md#available-models) riporta lo SHA-1 di `ggml-large-v3-turbo-q5_0.bin`: `e050f7970618a659205450ad97eb95a18d69c9ee`. Il [repository dei pesi convertiti](https://huggingface.co/ggerganov/whisper.cpp) e [whisper.cpp](https://github.com/ggml-org/whisper.cpp) indicano licenza MIT. Conservare le relative licenze se si redistribuiscono binari o pesi.

### Windows x64

La [release ufficiale v1.9.2](https://github.com/ggml-org/whisper.cpp/releases/tag/v1.9.2) offre `whisper-bin-x64.zip` per CPU: **8.194.445 byte**, SHA-256 GitHub `49dcc16de826f20bd53d44f947a1ae49dfa81f86cad67a64d80820cb192d674a`. È la variante semplice per la prima prova; l'i7-8700 potrebbe essere lento con il modello candidato. Si misura la latenza e si valuta una build GPU separata, senza sostituire in silenzio il checkpoint.

```powershell
$asrRoot = Join-Path $env:USERPROFILE 'Tools\diario-local-asr'
New-Item -ItemType Directory -Force -Path $asrRoot | Out-Null
$archive = Join-Path $asrRoot 'whisper-bin-x64-v1.9.2.zip'
Invoke-WebRequest 'https://github.com/ggml-org/whisper.cpp/releases/download/v1.9.2/whisper-bin-x64.zip' -OutFile $archive
(Get-FileHash $archive -Algorithm SHA256).Hash.ToLowerInvariant()
# Continuare solo se il valore coincide con 49dcc16de826f20bd53d44f947a1ae49dfa81f86cad67a64d80820cb192d674a
Expand-Archive -LiteralPath $archive -DestinationPath (Join-Path $asrRoot 'whisper-bin')
Get-ChildItem (Join-Path $asrRoot 'whisper-bin') -Recurse -Filter whisper-cli.exe
```

Il percorso restituito nell'ultima riga, con le DLL estratte accanto, è il valore di `--whisper-cli`. Scaricare il modello solo quando si è pronti a provarlo:

```powershell
$model = Join-Path $asrRoot 'ggml-large-v3-turbo-q5_0.bin'
Invoke-WebRequest 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo-q5_0.bin?download=true' -OutFile $model
(Get-FileHash $model -Algorithm SHA1).Hash.ToLowerInvariant()
# Continuare solo se coincide con e050f7970618a659205450ad97eb95a18d69c9ee
$cli = (Get-ChildItem (Join-Path $asrRoot 'whisper-bin') -Recurse -Filter whisper-cli.exe | Select-Object -First 1).FullName
python local-asr/server.py --whisper-cli "$cli" --model "$model" --origin http://127.0.0.1:4173
```

Eseguire l'ultimo comando dalla root del progetto. Arrestare con `Ctrl+C`.

La variante GPU Windows è **opzionale e richiede un runtime CUDA compatibile**, oltre al binario: nella prova riferita dal coordinatore, l'archivio ufficiale `whisper-cublas-11.8.0-bin-x64.zip` v1.9.2 (SHA-256 `1776668730f5594a0b15f930225779e863dd8280397f9ee7c6e47ccf82bbb203`) non includeva `cublas64_11.dll` e `cublasLt64_11.dll`. Il backend RTX 2070 è partito dopo averle ottenute dal wheel NVIDIA ufficiale `nvidia-cublas-cu11==11.11.3.6` (SHA-256 `6ab12b1302bef8ac1ff4414edd1c059e57f4833abef9151683fb8f4de25900be`). Sul medesimo clip italiano di 2,64 s, con lo stesso modello e testo corretto, `whisper_print_timings total time` è stato **49,28 s GPU** contro **24,48 s CPU**. È un solo clip: non raccomandare la GPU su questa RTX in base al nome del backend; misurare la latenza sui clip e sulle durate d'uso reali prima di scegliere.

### macOS Apple Silicon

La release v1.9.2 non pubblica un `whisper-cli` precompilato per Mac: compilare il tag ufficiale con CMake e Xcode Command Line Tools già consentiti sul dispositivo. È lo **stesso codice v1.9.2** del binario Windows e lo stesso modello; il backend Mac usa Metal. Se Git, CMake o gli strumenti di build mancano o sono bloccati da policy, registrarli come dipendenza mancante.

```sh
asr_root="$HOME/Tools/diario-local-asr"
mkdir -p "$asr_root"
git clone --depth 1 --branch v1.9.2 https://github.com/ggml-org/whisper.cpp.git "$asr_root/whisper.cpp"
cmake -S "$asr_root/whisper.cpp" -B "$asr_root/whisper.cpp/build" -DGGML_METAL=ON
cmake --build "$asr_root/whisper.cpp/build" --config Release -j 4
model="$asr_root/ggml-large-v3-turbo-q5_0.bin"
curl --fail --location 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo-q5_0.bin?download=true' --output "$model"
shasum -a 1 "$model"
# Continuare solo se coincide con e050f7970618a659205450ad97eb95a18d69c9ee
python3 local-asr/server.py --whisper-cli "$asr_root/whisper.cpp/build/bin/whisper-cli" --model "$model" --origin http://127.0.0.1:4173
```

Eseguire l'ultimo comando dalla root del progetto. Il test sul Mac di destinazione resta da svolgere.

## Contratto HTTP v1

URL predefinito, completo: `http://127.0.0.1:8765/asr`. L'app deve salvare e usare **schema, host, porta e percorso interi**; non aggiunge `/inference` o `/v1/audio/transcriptions`. Si possono cambiare `--host` (`127.0.0.1` o `::1`), `--port`, `--path` e `--origin` all'avvio. Il server non emette redirect; rifiuta un header `Host` diverso dal proprio listener. CORS ammette esattamente l'origine passata con `--origin` (predefinita `http://127.0.0.1:4173`) e solo `GET`, `POST`, `OPTIONS`. Un `POST` senza quell'origine è rifiutato.

`GET` allo stesso URL restituisce, ad esempio:

```json
{"api":"diario-local-asr","version":1,"ready":true,"language":"it","model":"ggml-large-v3-turbo-q5_0.bin","accept":["audio/wav"],"maxAudioBytes":20000000,"maxDurationSeconds":600,"timestamps":true}
```

`ready` verifica presenza del file binario e del file modello non vuoto, escludendo nomi `.en`; **non certifica** che il modello sia già caricato in RAM né che l'inferenza funzioni. Il primo `POST` carica il modello e rende osservabili gli errori reali del runtime. Per verificare prima un endpoint serve un clip innocuo inviato con azione esplicita.

`POST` allo stesso URL usa `multipart/form-data` con due campi: `audio` (file WAV mono PCM16/16 kHz, `Content-Type: audio/wav`) e `language` (`it`). La risposta usa secondi relativi all'audio inviato:

```json
{"api":"diario-local-asr","version":1,"language":"it","model":"ggml-large-v3-turbo-q5_0.bin","segments":[{"start":0.25,"end":1.7,"text":"Ciao a tutti"}],"text":"Ciao a tutti"}
```

Il client aggiunge l'offset della registrazione alla propria timeline; l'helper non riceve ID di sessione, note, titoli o file originali. I segmenti vuoti sono omessi. Un WAV PCM16 di **silenzio digitale esatto** produce `segments: []` e `text: ""` senza invocare whisper-cli; questo vale soltanto per il chunk inviato e non dimostra che l'intero media sia silenzioso. Non viene applicata una soglia arbitraria al quasi silenzio. La qualità e la precisione dei timestamp devono essere misurate con clip di riferimento.

Per uno smoke volontario con un **clip WAV innocuo già preparato**, usare un client che invii l'`Origin` ammessa. Su Windows:

```powershell
curl.exe --fail-with-body -H 'Origin: http://127.0.0.1:4173' -F 'language=it' -F 'audio=@C:\percorso\clip-italiano.wav;type=audio/wav' http://127.0.0.1:8765/asr
```

Su macOS sostituire `curl.exe` con `curl` e usare il percorso POSIX del clip. `GET http://127.0.0.1:8765/asr` è solo preflight, non una prova di inferenza. Nel client browser usare `redirect: "error"` sia per health sia per POST, oltre a verificare che l'URL configurato sia loopback.

Limiti: **20 MB** di WAV, **600 secondi** per richiesta, un job per volta e timeout CLI predefinito di **900 secondi**. Per una registrazione lunga il client deve preparare e inviare finestre audio distinte, mantenendo la propria copertura e gli offset; non inviare video o un WAV di ore. Il payload e i file temporanei possono occupare memoria e spazio fino al limite per job. L'adattatore non conserva trascrizioni.

Gli errori sono JSON `{"error":{"code":"...","message":"..."}}`: 400 per richiesta malformata, 403 origine negata, 404 path errato, 411 lunghezza assente, 413 audio troppo grande/lungo, 415 formato non WAV PCM16 o campioni troncati, 422 lingua diversa oppure `untrusted_timing` se whisper-cli produce testo fuori durata, 429 motore occupato, 502 errore/output strutturalmente invalido di whisper-cli, 503 motore non configurato, 504 timeout. In caso di `untrusted_timing` non viene accettato alcun segmento del job. `AbortSignal` nel browser interrompe la richiesta; l'adattatore rileva la chiusura della connessione e termina il processo CLI. Un eventuale output interrotto non viene promosso a trascrizione completa.

## Verifica locale

Senza binario e modello, i test sintetici controllano CORS, path, richiesta audio-only, lingua, struttura dei risultati, limiti ed errori:

```sh
python -m unittest discover -s local-asr -p 'test_*.py' -v
```

Il coordinatore ha riferito uno smoke reale Windows con `whisper-cli` v1.9.2 CPU e `large-v3-turbo-q5_0` con SHA-1 ufficiale verificato: clip CC0 italiana di 2,64 s, testo corrispondente al riferimento «Aspettiamo un po', perché a volte ci vuole un po' di tempo.» e segmento 0,0–2,4 s. La [CI su Apple Silicon](https://github.com/sabhalo/diario-lavoro-web/actions/runs/35945139014) ha compilato lo stesso tag con Metal e verificato sul medesimo clip la risposta HTTP, il testo e un segmento temporizzato; il POST è durato 40,30 s sul runner. Queste prove non misurano la qualità generale né le prestazioni su sessioni lunghe. Una prova sul Mac di destinazione resta da svolgere.
