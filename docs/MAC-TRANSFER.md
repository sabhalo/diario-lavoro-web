# Avvio locale sul Mac

Questa è una web app statica, non un'applicazione macOS eseguibile. Non richiede driver, helper o privilegi amministrativi; richiede però che Git, Python 3 e Chrome siano già consentiti dall'ambiente.

## Dal repository pubblicato

Sostituire `<URL-GitHub-del-repository>` con l'URL GitHub comunicato insieme al branch pubblicato.

```bash
git clone <URL-GitHub-del-repository> diario-lavoro-web
cd diario-lavoro-web
git switch codex/media-only-continuous-capture
python3 -m http.server 4173 --bind 127.0.0.1
```

Aprire `http://127.0.0.1:4173/` in Chrome. Per una copia già clonata: entrare nella cartella, usare `git pull --ff-only` sul branch pubblicato e riavviare il server. Fermarlo con `Ctrl+C` quando non serve più.

## Prima prova sicura

1. Creare una sessione e rendere l'attestazione solo dopo avere verificato regole e consenso applicabili.
2. In Chrome scegliere il **monitor intero** e, quando consentito, l'audio del computer; scegliere il microfono nella richiesta separata.
3. Usare solo un suono e una voce innocui. Confermare i due riascolti separati prima della modalità completa.
4. Avviare, lasciare scorrere almeno due frammenti da 30 secondi, fermare il tratto e verificare intervalli, riproduzione ed export locale.

La build registra solo video e audio. Non scarica modelli, non esegue ASR e non genera trascrizioni. Non concedere permessi, non cambiare policy e non passare tacitamente a una modalità ridotta se l'ambiente aziendale lo vieta o non lo chiarisce.

## Evidenze ancora richieste

Il caricamento browser locale e i test automatici non dimostrano la cattura reale. Restano da misurare sul Mac M4 Pro e, separatamente, su Windows: permessi, codec effettivi, continuità tra frammenti, riproduzione/export, quota, recupero dopo crash/sleep e una prova lunga. Il gate policy aziendale per dati reali o altre persone rimane distinto e obbligatorio.
