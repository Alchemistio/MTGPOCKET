# Serveur Commander Pocket

Serveur Node.js + TypeScript + WebSocket pour les parties sur réseau local.

## Démarrage

```sh
pnpm install
pnpm --filter @commander-pocket/server dev
```

- Health check : `GET http://<ip-hôte>:3000/health`
- WebSocket : `ws://<ip-hôte>:3000/ws`

## Messages de base

Créer une salle (le créateur reçoit le siège 0 et les jetons à distribuer aux autres joueurs) :

```json
{
  "type": "create-room",
  "gameId": "table-001",
  "players": [
    { "id": "p1", "name": "Alice", "seat": 0 },
    { "id": "p2", "name": "Bob", "seat": 1 },
    { "id": "p3", "name": "Chloé", "seat": 2 },
    { "id": "p4", "name": "David", "seat": 3 }
  ]
}
```

Rejoindre avec le jeton personnel :

```json
{ "type": "join-room", "gameId": "table-001", "playerId": "p2", "token": "<seat-token>" }
```

Passer la priorité :

```json
{
  "type": "command",
  "command": {
    "protocolVersion": 1,
    "gameId": "table-001",
    "commandId": "unique-command-id",
    "playerId": "p1",
    "expectedRevision": 1,
    "type": "pass-priority",
    "payload": {}
  }
}
```

Le serveur vérifie le jeton de siège, l'identité associée à la connexion, l'idempotence et la révision attendue. Les vues sont projetées par joueur : la main adverse et les identités de bibliothèque ne sont pas envoyées.

## Limites actuelles

Le bootstrap gère la création de salle, la connexion par jeton, le health check et le passage de priorité. Les commandes de jeu autres que `pass-priority`, la persistance, la découverte automatique LAN, TLS, la reconnexion et les decks ne sont pas encore activés. Les jetons sont distribués par l'hôte : réserver ce mode au réseau local de confiance jusqu'à l'ajout d'un flux d'invitation sécurisé.
