# REPRISE — Commander Pocket

> Lire ici en premier après interruption. État courant seulement. Mettre à jour à chaque avancée.
> Workflow obligatoire : [DEVELOPMENT_WORKFLOW.md](DEVELOPMENT_WORKFLOW.md).

## Repères
- Repo: https://github.com/Alchemistio/MTGPOCKET
- Branche: feat/commander-pocket-foundation
- PR #1: https://github.com/Alchemistio/MTGPOCKET/pull/1 — draft; ne pas merger sans demande.
- Latest code: 407148d; CI run 43624148803 verte (typecheck, Vitest, Python). Les commits docs peuvent avancer indépendamment.
- Stack: pnpm, TypeScript strict, Expo/React Native, Node/WebSocket, moteur partagé, Scryfall, SQLite, ETL Python.

## Fait — caveman
- 4 sièges, salle LAN, jetons, WebSocket, vues privées par siège.
- Moteur: tours/phases/priorité/pile de base; PV, pioche, taxes, commandant, élimination.
- Pré-partie serveur + transport: deck, mulligan, bottom, start.
- Mobile: plateau paysage, télémétrie, client LAN, recherche Scryfall, deckbuilder minimal + modal pré-partie.
- Données: cache SQLite mobile; import MTGJSON Python.
- Catalogue serveur: loader snapshot Scryfall + policy Commander versionnée; validation fail closed (IDs, références catalogue, doublons, paires, dates calendaires strictes).
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
1. Générer snapshot réel puis valider provenance.
2. Curater policy Commander vérifiée et versionnée.
3. Test 4 sièges + confidentialité; puis appareils iOS/Android.

## Règles
- Workflow: DEVELOPMENT_WORKFLOW.md; avant d'attendre CI, vérifier et terminer toutes les actions indépendantes possibles. Ne pas s'arrêter si du travail sûr reste.
- CI commit exact; codé ≠ CI ≠ appareil testé.
- Mettre ce fichier à jour après chaque avancée; caveman, état courant seulement.
- PR draft; pas de merge sans demande.
