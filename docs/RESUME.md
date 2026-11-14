# REPRISE — Commander Pocket

> Lire ici en premier après interruption. État courant seulement. Mettre à jour à chaque avancée.

## Repères
- Repo: https://github.com/Alchemistio/MTGPOCKET
- Branche: feat/commander-pocket-foundation
- PR #1: https://github.com/Alchemistio/MTGPOCKET/pull/1 — draft; ne pas merger sans demande.
- HEAD: 8b41374 (docs); dernier code CI vert: 73cca32, run 43619439316 (typecheck, Vitest, Python). Validation policy renforcée en cours; CI à vérifier.
- Stack: pnpm, TypeScript strict, Expo/React Native, Node/WebSocket, moteur partagé, Scryfall, SQLite, ETL Python.

## Fait — caveman
- 4 sièges, salle LAN, jetons, WebSocket, vues privées par siège.
- Moteur: tours/phases/priorité/pile de base; PV, pioche, taxes, commandant, élimination.
- Pré-partie serveur + transport: deck, mulligan, bottom, start.
- Mobile: plateau paysage, télémétrie, client LAN, recherche Scryfall, deckbuilder minimal + modal pré-partie.
- Données: cache SQLite mobile; import MTGJSON Python.
- Catalogue serveur: loader snapshot Scryfall + policy Commander versionnée; validation fail closed (IDs, références catalogue, doublons, paires, dates strictes).
- Générateur bulk Scryfall streaming: manifeste, default_cards, SHA-256, provenance, écriture atomique, tests.
- CI verte; aucun appareil testé.

## Bloqueurs
- Snapshot réel non généré/provisionné; policy Commander réelle non validée.
- Policy éligibilité/banlist/partenaires doit être maintenue explicitement; pas de source officielle importée automatiquement.
- Partie complète non prouvée; effets, combat, SBA incomplets.
- Découverte LAN, reconnexion, sécurité production absentes.
- Test transport réel à 4 clients non fait.
- Ne jamais exposer GameState brut ni mains adverses.

## Prochain
1. CI du durcissement policy à vérifier.
2. Générer snapshot réel puis valider provenance.
3. Curater policy Commander vérifiée et versionnée.
4. Test 4 sièges + confidentialité; puis appareils iOS/Android.

## Règles
- Fetch HEAD avant écriture; update_ref expected SHA, force=false.
- CI commit exact; codé ≠ CI ≠ appareil testé.
- Mettre ce fichier à jour après chaque avancée; caveman, état courant seulement.
- PR draft; pas de merge sans demande.
