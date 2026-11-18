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

\n## Première commande d'activation
- `activate-ability` reçoit uniquement `{ instanceId, abilityIndex }` ; le serveur retrouve la définition Scryfall et compile la ligne Oracle correspondante.
- Le client ne fournit ni coût, ni payload d'effet, ni source de vérité sur la capacité.
- La première tranche accepte seulement les lignes exactes sans cible `[coût]: Draw a card.` et `[coût]: You gain N life.`, avec coût en symboles numériques/WUBRGC et `{T}`.
- Les capacités inconnues, les coûts hybrides/phyrexians/variables et les capacités de créature avec coût `{T}` sont rejetés explicitement.
- Les capacités de mana gardent la commande immédiate dédiée et ne passent pas par `activate-ability`.
\n\n## Choix de remplacement à l'entrée d'un permanent\n- `resolve-zone-change-replacement` reçoit `{ pendingId, effectId }` ; la session et les candidats sont conservés par le serveur, jamais fournis par le client.\n- Seul le contrôleur du permanent entrant peut répondre dans cette première tranche ; les vues des autres sièges ne révèlent ni l'identifiant ni les candidats.\n- Si une nouvelle décision est nécessaire, la résolution reste suspendue, l'objet demeure au sommet de la pile et la carte reste dans la zone de pile.\n- Le journal de commandes permet le rejeu/restauration ; les fonctions de remplacement sont réhydratées par le résolveur serveur.\n- Limites : un seul permanent/choixeur à la fois ; les choix APNAP simultanés et événements imbriqués 616.1g restent non pris en charge.\n

## Ordre APNAP des capacités déclenchées ETB (version 1)
- `order-etb-triggers` reçoit `{ pendingId, orderedStackItemIds }`. Le client transmet uniquement une permutation d'identifiants ; les objets candidats et leurs payloads restent autoritaires côté serveur.
- Le serveur n'accepte la commande que du prochain contrôleur dans l'ordre APNAP, puis vérifie que la liste est une permutation exacte des triggers de ce contrôleur.
- Les groupes à un seul trigger sont déjà ordonnés automatiquement. Les autres contrôleurs ne reçoivent leur demande qu'après la décision APNAP précédente.
- `GameView.pendingTriggerOrder` révèle le batch et les IDs candidats uniquement au contrôleur dont c'est le tour d'ordonner ; `pendingTriggerOrderCount` ne révèle que le nombre de groupes restant.
- Le batch est inclus dans le snapshot et ses décisions dans le journal de commandes ; restauration/rejeu reproduit le même ordre.
- Limite : les candidats ne sont pas encore générés depuis le chemin live, ne sont pas insérés dans la pile et le batch reste bloquant même lorsque tous les groupes sont ordonnés. Le checkpoint de priorité/SBA et la finalisation sur la pile seront ajoutés séparément.
