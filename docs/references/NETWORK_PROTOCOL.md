# Référence locale — protocole LAN Commander Pocket

- **Version actuelle :** 1.
- **Vérifié :** 2026-11-13.
- **Implémentation :** `packages/protocol/src/index.ts`, `apps/server/src/game-room.ts`, `apps/server/src/player-view.ts`, `apps/server/src/server.ts`, `apps/mobile/src/network/room-client.ts`.

## Transport et session
- WebSocket sur `/ws`, avec ping/pong.
- Un siège est associé à un jeton privé émis lors de la création de salle.
- Le serveur associe chaque connexion à un `gameId` et un `playerId`.
- Le serveur est l'autorité de l'état ; le client ne transmet que des intentions.

## Enveloppe de commande

Champs : `protocolVersion`, `gameId`, `commandId`, `playerId`, `expectedRevision`, `type`, `payload`.

- `commandId` permet l'idempotence ; un retry avec le même ID renvoie le résultat déjà enregistré.
- `expectedRevision` protège contre les commandes concurrentes/périmées.
- Le serveur vérifie le siège associé à la socket, et pas seulement le `playerId` du message.
- Les commandes inconnues ou mal formées sont rejetées.

## Commandes actives à la date de la fiche
- `pass-priority` : passer la priorité si le siège possède la priorité.
- `resolve-commander-return` : payload `{ instanceId, choice: "command" | "stay" }`. Seul le propriétaire peut résoudre le choix correspondant.

Les autres intentions de jeu (lancer un sort, payer, choisir une cible, déclarer attaquants/bloqueurs, résoudre une capacité, mulligan, défausse) restent à ajouter.

## Vues privées
- Le propriétaire reçoit l'identité de ses cartes en main.
- Les autres sièges ne reçoivent que le nombre de cartes en main.
- L'ordre et l'identité de toutes les bibliothèques restent privés.
- Les choix de retour du commandant sont envoyés uniquement au propriétaire ; les autres voient un compteur de choix en attente.
- Les cartes sur champ de bataille, cimetière, exil et commandement sont publiques dans le périmètre du modèle actuel.

## Limites de sécurité
Ce prototype n'est pas encore prêt pour un réseau non fiable : transport local en clair `ws://`, jetons de siège longue durée, pas de rotation, pas de limite complète de débit/taille, pas de persistance ni de reprise après reconnexion. Ne pas exposer ce serveur directement sur Internet.

## Évolution
Toute rupture de message doit incrémenter `protocolVersion` et être documentée. Ajouter des validateurs de payload exhaustifs, limites de taille, authentification, tests anti-rejeu, snapshots et rejeu avant de déclarer le LAN prêt pour la bêta.
