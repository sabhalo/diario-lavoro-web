# Regole Git per gli agenti

## Branch di riferimento

- `main` e' il branch principale e la base per ogni nuovo lavoro.
- Non sviluppare direttamente su `main` e non riscriverne la cronologia.
- Prima di aprire un branch, aggiornare il riferimento locale a `main` senza sovrascrivere modifiche non correlate nel checkout.

## Nuove funzionalita'

- Creare ogni nuova funzionalita' da `main` con il formato `feature/<descrizione-breve-kebab-case>`.
- Esempio: `feature/export-markdown`.
- Mantenere il branch limitato alla funzionalita' richiesta; testare prima di proporne l'integrazione in `main`.

## Correzioni

- Creare ogni correzione da `main` con il formato `fix/<descrizione-breve-kebab-case>`.
- Esempio: `fix/microphone-permission-retry`.
- Tenere la correzione mirata e includere o aggiornare i test che riproducono il difetto, quando applicabile.

## Integrazione

- Proporre l'integrazione verso `main` solo dopo la revisione e le verifiche adeguate al cambiamento.
- Non eliminare branch, non forzare push e non modificare branch altrui senza una richiesta esplicita dell'utente.
