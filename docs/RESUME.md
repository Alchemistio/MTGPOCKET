# REPRISE — Commander Pocket

> Lire ici en premier après interruption. État courant seulement. Mettre à jour à chaque avancée.
> Workflow obligatoire : [DEVELOPMENT_WORKFLOW.md](DEVELOPMENT_WORKFLOW.md).

## Repères
- Repo: https://github.com/Alchemistio/MTGPOCKET
- Branche: feat/commander-pocket-foundation
- PR #1: https://github.com/Alchemistio/MTGPOCKET/pull/1 — draft; ne pas merger sans demande.
- Dernier code : réponse instant adverse avec résolution LIFO, défausse de cleanup et transition vers l'upkeep suivant; CI à vérifier sur le commit courant.
- Stack: pnpm, TypeScript strict, Expo/React Native, Node/WebSocket, moteur partagé, Scryfall, SQLite, ETL Python.

## Fait — caveman
- 4 sièges, salle LAN, jetons, WebSocket, vues privées par siège.
- Moteur: tours/phases/priorité/pile de base; PV, pioche, taxes, commandant, élimination.
- Pré-partie serveur + transport: deck, mulligan, bottom, start; après start, le GameRoom reçoit le même état validé, les mains et instances, et démarre à upkeep avec priorité.
- Journal mémoire des commandes acceptées et replay déterministe depuis le snapshot de départ; chaque entrée porte les versions moteur/protocole. Le GameRoom résout la pile après passes unanimes si un handler serveur déterministe est configuré.
- Mobile: plateau paysage, télémétrie, client LAN, recherche Scryfall, deckbuilder minimal + modal pré-partie. La vue réseau expose désormais `status` (`pregame`/`active`/`finished`) ; l'écran ne quitte la pré-partie qu'à `active`.
- Données: cache SQLite mobile; import MTGJSON Python.
- Catalogue serveur: loader snapshot Scryfall + policy Commander versionnée; validation fail closed (IDs, références catalogue, doublons, paires, dates calendaires strictes).
- Générateur bulk Scryfall streaming: manifeste, default_cards, SHA-256, provenance, écriture atomique, tests.
- CI verte sur 5cb495c (run 43636239192); aucun appareil testé.

## Bloqueurs
- Snapshot réel non généré/provisionné; policy Commander réelle non validée.
- Policy éligibilité/banlist/partenaires doit être maintenue explicitement; pas de source officielle importée automatiquement.
- Partie complète non prouvée; les permanents, sorts ciblés, coûts hybrides/phyrexians/X/snow et handlers de cartes de production restent non raccordés; combat et SBA incomplets. Le journal n'est pas encore persistant, ne capture pas les graines de pré-partie et ne survit pas à un redémarrage. Un test WebSocket à quatre clients couvre la pré-partie et la première passe; aucun test sur quatre appareils physiques.
- Le flux mobile pré-partie n'a pas encore de reprise robuste après timeout/déconnexion; aucun test sur appareils physiques.
- Découverte LAN, reconnexion, sécurité production absentes.
- Ne jamais exposer GameState brut ni mains adverses.

## Prochain
1. Implémenter un cycle sort/réponse/résolution/cleanup avec validation serveur.
2. Persister le journal, capturer les graines et permettre le rejeu après redémarrage.
3. Générer le snapshot Scryfall réel et curater la policy Commander officielle.

## Règles
- Workflow: DEVELOPMENT_WORKFLOW.md; avant d'attendre CI, vérifier et terminer toutes les actions indépendantes possibles. Ne pas s'arrêter si du travail sûr reste.
- CI commit exact; codé ≠ CI ≠ appareil testé.
- Mettre ce fichier à jour après chaque avancée; caveman, état courant seulement.
- PR draft; pas de merge sans demande.
