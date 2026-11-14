# REPRISE — Commander Pocket

> Lire ici en premier après interruption. État courant seulement. Mettre à jour à chaque avancée.

## Repères
- Repo: https://github.com/Alchemistio/MTGPOCKET
- Branche: `feat/commander-pocket-foundation`
- PR #1: https://github.com/Alchemistio/MTGPOCKET/pull/1 — draft; ne pas merger sans demande.
- HEAD: `d83f9c2`; CI run 43607532811: python-data verte, validate échoue au typecheck (nom de variable de test dupliqué), correctif en cours.
- Stack: pnpm, TypeScript strict, Expo/React Native, Node/WebSocket, moteur partagé, Scryfall, SQLite, ETL Python.

## Fait — caveman
- 4 sièges, salle LAN, jetons, WebSocket, vues privées.
- Moteur: tours/phases/priorité/pile de base; PV, pioche, taxes, commandant, élimination.
- Pré-partie serveur: decks validés, commandants, mains, mulligan, bottom, start.
- Pré-partie WebSocket: 4 messages authentifiés; vues privées recalculées et diffusées par siège après chaque action.
- Mobile: plateau paysage, télémétrie, client LAN, recherche Scryfall, constructeur deck local minimal + modal pré-partie/mulligan branchés à la salle.
- Données: Scryfall, cache SQLite, import MTGJSON Python.
- CI: typecheck, Vitest, Python.

## Bloqueurs
- Serveur sans catalogue carte + policy Commander versionnée injectés: `PREGAME_NOT_CONFIGURED`.
- Deckbuilder minimal branché (recherche + liste 100 cartes + commandant); validation serveur bloquée sans catalogue/policy réels.
- Partie complète non prouvée; effets, combat, SBA incomplets.
- Découverte LAN, reconnexion, sécurité production absentes.
- Ne jamais exposer GameState brut ni mains adverses.

## Prochain
1. Injecter catalogue serveur + policy Commander versionnée; bootstrap actuel renvoie `PREGAME_NOT_CONFIGURED`.
2. Tester 4 sièges: deck → mulligan → bottom → start + confidentialité, transport réel.
3. Valider UI iOS/Android; corriger deckbuilder.
4. Tour complet: sort → réponse → résolution → cleanup.

## Règles
- Fetch HEAD avant chaque écriture; update_ref avec expected SHA, force=false.
- Lire CI du commit exact; codé ≠ CI verte ≠ appareil testé.
- Mettre ce fichier à jour après chaque avancée. Garder seulement l'état courant, pas de récit.
- PR draft. Pas de merge sans demande.
