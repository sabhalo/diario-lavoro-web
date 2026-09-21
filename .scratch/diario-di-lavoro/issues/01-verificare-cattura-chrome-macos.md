Parent: ../map.md
Type: research
Status: resolved

# Verificare cattura completa in Chrome su macOS

## Question

Quali combinazioni documentate di Chrome e macOS permettono a una normale web app, senza driver/helper né privilegi amministratore, di acquisire schermo intero, audio del computer (anche di altre applicazioni) e microfono nella stessa sessione? Distinguere API disponibili, richieste di permesso, limiti della scelta dello schermo, audio scheda, audio finestra e audio di sistema. Cercare fonti primarie aggiornate e una prova riproducibile sul Mac aziendale; documentare separatamente ciò che le fonti attestano e ciò che la prova locale dimostra. Nessuna prova Windows sostituisce quella Mac.

## Answer

Baseline documentale prudente: **Chrome 142+ su macOS 14.2+**, con permessi utente e policy aziendali che lo consentano. Il [commit Chromium M142](https://chromium.googlesource.com/chromium/src.git/+/67570055fc09f0ac5abe0931f35fa33e9a95bc8c%5E%21/) abilita per impostazione predefinita l'audio di sistema ScreenShare via Core Audio Tap; [Apple](https://developer.apple.com/documentation/coreaudio/capturing-system-audio-with-core-audio-taps) colloca i tap in macOS 14.2+. La disponibilità dell'API, il flag attivo e `audio: true` non garantiscono una traccia udibile: il browser può restituire solo video, la scelta è dell'utente e il microfono richiede un flusso separato. Le policy Chrome e i profili macOS possono bloccare i permessi. Chrome 141 documenta `windowAudio` come suggerimento, non come prova della combinazione completa.

Ho raccolto fonti, limiti e protocollo riproducibile in [Cattura completa in Chrome su macOS — verifica documentale](../research/cattura-chrome-macos.md). **Non è stata eseguita una prova sul Mac aziendale:** ambiente disponibile Windows. La verifica del contenuto audio reale, delle versioni e dei blocchi osservati resta nel ticket [Verificare il Mac aziendale senza cambiare policy](05-verificare-mac-aziendale.md), che ora è sbloccato. Nessuna funzionalità del prodotto è stata implementata.
