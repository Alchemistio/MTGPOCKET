# REPRISE — Commander Pocket

> Lire ici en premier après interruption. État courant seulement. Mettre à jour à chaque avancée.
> Workflow obligatoire : [DEVELOPMENT_WORKFLOW.md](DEVELOPMENT_WORKFLOW.md).

## Repères
- Repo: https://github.com/Alchemistio/MTGPOCKET
- Branche: feat/commander-pocket-foundation
- PR #1: https://github.com/Alchemistio/MTGPOCKET/pull/1 — draft; ne pas merger sans demande.
- Dernier code : 7d6b320 capture côté serveur les graines d'ouverture et de mulligan en mémoire, sans les exposer aux vues client. CI run 43689458355 verte sur ce SHA (typecheck, Vitest, Python). Les délais réseau mobiles sont couverts par le commit précédent 8e9d305 et son run 43689300902.
- PR #1 toujours draft; aucun merge.
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
- Dernière CI complète : run 43689458355 sur 7d6b320, verte; aucun appareil testé.

## Bloqueurs
- Snapshot réel non généré/provisionné; policy Commander réelle non validée.
- Policy éligibilité/banlist/partenaires doit être maintenue explicitement; pas de source officielle importée automatiquement.
- Partie complète non prouvée. Le bootstrap active un sous-ensemble d'effets uniquement si catalogue + policy sont provisionnés : instant/rituel normal, coûts simples, sans cible, texte Oracle exact « Draw a card/two/three cards » ou « You gain N life ». Permanents, cibles, coûts hybrides/phyrexians/X/snow, autres textes, combat détaillé et SBA incomplets. Le journal n'est pas encore persistant et ne survit pas à un redémarrage; les graines d'ouverture/mulligan sont capturées en mémoire côté serveur mais pas encore persistées. Un test WebSocket à quatre clients couvre la pré-partie et la première passe; aucun test sur quatre appareils physiques.
- Le client réseau borne les délais de connexion et de handshake; le panneau pré-partie déverrouille l'UI et signale la déconnexion. Les actions pré-partie expirent après 10 s et imposent une reconnexion avant nouvel envoi; pas de reprise/réauthentification automatique. Aucun test sur appareils physiques.
- Découverte LAN, reconnexion, sécurité production absentes.
- Ne jamais exposer GameState brut ni mains adverses.

## Prochain
1. Étendre prudemment le registre d'effets avec des cartes et cas de test vérifiés; ajouter génération de mana/terrains et commandes de capacités.
2. Persister durablement le snapshot, le journal de commandes et le seed log; permettre le rejeu après redémarrage.
3. Générer le snapshot Scryfall réel et curater la policy Commander officielle.

## Règles
- Workflow: DEVELOPMENT_WORKFLOW.md; avant d'attendre CI, vérifier et terminer toutes les actions indépendantes possibles. Ne pas s'arrêter si du travail sûr reste.
- CI commit exact; codé ≠ CI ≠ appareil testé.
- Mettre ce fichier à jour après chaque avancée; caveman, état courant seulement.
- PR draft; pas de merge sans demande.
