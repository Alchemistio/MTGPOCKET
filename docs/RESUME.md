# REPRISE — Commander Pocket

> Lire ici en premier après interruption. État courant seulement. Mettre à jour à chaque avancée.

## Repères
- Repo: https://github.com/Alchemistio/MTGPOCKET
- Branche: feat/commander-pocket-foundation
- PR #1: https://github.com/Alchemistio/MTGPOCKET/pull/1 — draft; ne pas merger sans demande.
- HEAD code: b3e3c0a; CI 43615546352 verte: typecheck, Vitest, Python.
- Stack: pnpm, TypeScript strict, Expo/React Native, Node/WebSocket, moteur partagé, Scryfall, SQLite, ETL Python.

## Fait — caveman
- 4 sièges, salle LAN, jetons, WebSocket, vues privées par siège.
- Moteur: tours/phases/priorité/pile de base; PV, pioche, taxes, commandant, élimination.
- Pré-partie serveur + transport: deck, mulligan, bottom, start.
- Mobile: plateau paysage, télémétrie, client LAN, recherche Scryfall, deckbuilder minimal + modal pré-partie.
- Données: cache SQLite mobile; import MTGJSON Python.
- Catalogue serveur: snapshot Scryfall JSON + policy Commander versionnée; bannis, éligibilité, paires compatibles, exceptions singleton; bootstrap env; validation fail closed.
- CI code verte; aucun appareil testé.

## Bloqueurs
- Snapshot Scryfall réel et policy validée non provisionnés; sans env, PREGAME_NOT_CONFIGURED.
- Partie complète non prouvée; effets, combat, SBA incomplets.
- Découverte LAN, reconnexion, sécurité production absentes.
- Test transport réel à 4 clients non fait.
- Ne jamais exposer GameState brut ni mains adverses.

## Prochain
1. Générer/provisionner snapshot Scryfall bulk + policy Commander vérifiée.
2. Test 4 sièges: deck → mulligan → bottom → start + confidentialité.
3. Valider UI iOS/Android.
4. Tour complet: sort → réponse → résolution → cleanup.

## Règles
- Fetch HEAD avant écriture; update_ref expected SHA, force=false.
- CI commit exact; codé ≠ CI ≠ appareil testé.
- Mettre ce fichier à jour après chaque avancée; caveman, état courant seulement.
- PR draft; pas de merge sans demande.
