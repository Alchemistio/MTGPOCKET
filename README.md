# Commander Pocket

Application mobile indépendante de jeu **Magic: The Gathering Commander à quatre joueurs** : parties locales, réseau local, mode solo, recherche de cartes et moteur de règles partagé.

## Choix technologiques

| Domaine | Technologie | Justification |
|---|---|---|
| Mobile iOS/Android | React Native + Expo + TypeScript | UI native partagée et intégration mobile |
| Moteur de règles | TypeScript strict, sans dépendance UI | Même logique locale/serveur, tests déterministes |
| Serveur multijoueur | Node.js + TypeScript + WebSocket | Faible latence et partage du modèle métier |
| Stockage local | SQLite | Offline-first |
| Données cartes | Adaptateurs Scryfall et MTGJSON | Recherche distante et données en masse |
| ETL ponctuel | Python si utile | Traitement de dumps, hors runtime de jeu |

## Architecture

`apps/mobile`, `apps/server`, `packages/game-engine`, `packages/card-data`, `packages/protocol`, `scripts/` et `docs/`.

## Démarrage

Node.js 22+ et pnpm :

```sh
corepack enable
pnpm install
pnpm typecheck
pnpm test

# Lancer le prototype mobile ou le serveur LAN
pnpm dev:mobile
pnpm dev:server
```

## Documentation

- [Spécification produit](docs/PRODUCT_SPEC.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Roadmap](docs/ROADMAP.md)
- [Périmètre des règles](docs/RULES_SCOPE.md)\n- [Sources de données](docs/DATA_SOURCES.md)\n- [Guide mobile et réseau local](apps/mobile/README.md)

Le moteur est développé par paliers. Une règle non implémentée doit être explicitement signalée, jamais simulée silencieusement. Projet indépendant, non affilié à Wizards of the Coast.
\n## État du prototype\nLe plateau mobile sait créer/rejoindre une salle LAN et transmettre le passage de priorité ; la recherche Scryfall et son cache SQLite sont branchés. Le serveur ne distribue pas encore les decks et le moteur ne couvre pas encore toutes les règles/cartes. Voir la [roadmap](docs/ROADMAP.md) pour les critères et les limites exactes.\n