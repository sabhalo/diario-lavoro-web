# Regole Git per gli agenti

## Branch di riferimento

- `main` e' il branch principale della versione pubblicata.
- `develop` e' il branch di integrazione e la base per ogni nuovo lavoro.
- Non sviluppare direttamente su `main` e non riscriverne la cronologia.
- Prima di aprire un branch, aggiornare il riferimento locale a `develop` senza sovrascrivere modifiche non correlate nel checkout.

## Nuove funzionalita'

- Creare ogni nuova funzionalita' da `develop` con il formato `feature/<descrizione-breve-kebab-case>`.
- Esempio: `feature/export-markdown`.
- Mantenere il branch limitato alla funzionalita' richiesta; testare prima di proporne l'integrazione in `develop`.

## Correzioni

- Creare ogni correzione da `develop` con il formato `fix/<descrizione-breve-kebab-case>`.
- Esempio: `fix/microphone-permission-retry`.
- Tenere la correzione mirata e includere o aggiornare i test che riproducono il difetto, quando applicabile.

## Integrazione

- Integrare funzionalita' e correzioni in `develop` dopo revisione e verifiche adeguate al cambiamento.
- Promuovere `develop` in `main` dopo la verifica della versione da pubblicare.
- Non eliminare branch, non forzare push e non modificare branch altrui senza una richiesta esplicita dell'utente.
