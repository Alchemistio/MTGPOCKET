# Serveur Commander Pocket

Node.js + TypeScript + WebSocket. Ce premier bootstrap fournit le health check HTTP et le transport WebSocket ; il ne traite pas encore de commandes de partie. L'autorité métier sera le package partagé `@commander-pocket/game-engine`. Les connexions devront être authentifiées et associées à un siège avant l'activation des commandes.
