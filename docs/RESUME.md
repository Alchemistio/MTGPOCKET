# REPRISE — Commander Pocket

> Lire ici en premier après interruption. État courant seulement. Mettre à jour à chaque avancée.

## Repères
- Repo: https://github.com/Alchemistio/MTGPOCKET
- Branche: feat/commander-pocket-foundation
- PR #1: https://github.com/Alchemistio/MTGPOCKET/pull/1 — draft; ne pas merger sans demande.
- HEAD avant cette tranche: c43cfb9; code 74b9f36 CI verte (43607608283). Nouveau commit à contrôler.
- Stack: pnpm, TypeScript strict, Expo/React Native, Node/WebSocket, moteur partagé, Scryfall, SQLite, ETL Python.

## Fait — caveman
- 4 sièges, salle LAN, jetons, WebSocket, vues privées.
- Moteur: tours/phases/priorité/pile de base; PV, pioche, taxes, commandant, élimination.
- Pré-partie serveur + transport: deck, mulligan, bottom, start; vues privées par siège.
- Mobile: plateau paysage, télémétrie, client LAN, recherche Scryfall, deckbuilder local minimal + modal pré-partie.
- Données: cache SQLite mobile; import MTGJSON Python.
- Catalogue serveur: loader snapshot Scryfall JSON + policy Commander versionnée; IDs Oracle explicites; bannis, commandants, paires compatibles, exceptions singleton; env bootstrap; fail closed.
- Tests: snapshots valides, policy invalide, carte mal formée, config env partielle.

## Bloqueurs
- Aucun snapshot Scryfall ni fichier policy réel provisionné; PREGAME_NOT_CONFIGURED sans env.
- Éligibilité/paires Commander doivent être maintenues dans la policy, pas inventées.
- Partie complète non prouvée; effets, combat, SBA incomplets.
- Découverte LAN, reconnexion, sécurité production absentes.
- Pas de test appareils ni de vraie session 4 clients revendiqués.
- Ne jamais exposer GameState brut ni mains adverses.

## Prochain
1. Générer/provisionner snapshot Scryfall bulk et policy Commander validée.
2. Tester 4 sièges: deck → mulligan → bottom → start + confidentialité, transport réel.
3. Valider UI iOS/Android; corriger deckbuilder.
4. Tour complet: sort → réponse → résolution → cleanup.

## Règles
- Fetch HEAD avant chaque écriture; update_ref avec expected SHA, force=false.
- Lire CI du commit exact; codé ≠ CI verte ≠ appareil testé.
- Mettre ce fichier à jour après chaque avancée. Garder seulement l'état courant, pas de récit.
- PR draft. Pas de merge sans demande.
