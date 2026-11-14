# REPRISE — Commander Pocket

> Lire ici en premier après interruption. État courant seulement. Mettre à jour à chaque avancée.

## Repères
- Repo: https://github.com/Alchemistio/MTGPOCKET
- Branche: `feat/commander-pocket-foundation`
- PR #1: https://github.com/Alchemistio/MTGPOCKET/pull/1 — draft; ne pas merger sans demande.
- HEAD avant tranche: `8f23a08` (CI verte: run 43598291958, validate + python-data). Tranche mobile: constructeur deck + pré-partie intégrés. CI run 43606919803: validate + python-data verts.
- Stack: pnpm, TypeScript strict, Expo/React Native, Node/WebSocket, moteur partagé, Scryfall, SQLite, ETL Python.

## Fait — caveman
- 4 sièges, salle LAN, jetons, WebSocket, vues privées.
- Moteur: tours/phases/priorité/pile de base; PV, pioche, taxes, commandant, élimination.
- Pré-partie serveur: decks validés, commandants, mains, mulligan, bottom, start.
- Pré-partie WebSocket: 4 messages, authentifiés, vues unicast.
- Mobile: plateau paysage, télémétrie, client LAN, recherche Scryfall, constructeur deck local minimal + modal pré-partie/mulligan branchés à la salle.
- Données: Scryfall, cache SQLite, import MTGJSON Python.
- CI: typecheck, Vitest, Python.

## Bloqueurs
- Serveur sans catalogue carte + policy Commander versionnée injectés: `PREGAME_NOT_CONFIGURED`.
- Progression mulligan multi-sièges pas encore diffusée aux autres clients; vues privées à pousser par siège.
- Deckbuilder minimal branché (recherche + liste 100 cartes + commandant); validation serveur bloquée sans catalogue/policy réels.
- Partie complète non prouvée; effets, combat, SBA incomplets.
- Découverte LAN, reconnexion, sécurité production absentes.
- Ne jamais exposer GameState brut ni mains adverses.

## Prochain
1. Diffuser progression mulligan/bottom aux 4 clients avec vue privée par siège.
2. Injecter catalogue serveur + policy Commander versionnée; bootstrap actuel renvoie `PREGAME_NOT_CONFIGURED`.
3. Tester 4 sièges: deck → mulligan → bottom → start + confidentialité.
4. Valider UI iOS/Android; puis tour complet.

## Règles
- Fetch HEAD avant chaque écriture; update_ref avec expected SHA, force=false.
- Lire CI du commit exact; codé ≠ CI verte ≠ appareil testé.
- Mettre ce fichier à jour après chaque avancée. Garder seulement l'état courant, pas de récit.
- PR draft. Pas de merge sans demande.
