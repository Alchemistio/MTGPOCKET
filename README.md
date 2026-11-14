# Commander Pocket

Application mobile indépendante de jeu **Magic: The Gathering Commander à quatre joueurs** : parties locales, réseau local, mode solo, recherche de cartes et moteur de règles partagé.

## Choix technologiques

| Domaine | Technologie | Rôle |
|---|---|---|
| Mobile iOS/Android | React Native + Expo + TypeScript | Interface native partagée |
| Moteur de règles | TypeScript strict | Domaine déterministe partagé local/serveur |
| Serveur multijoueur | Node.js + TypeScript + WebSocket | Autorité de partie et transport |
| Stockage mobile | SQLite | Cache, decks et données hors ligne |
| Cartes | Scryfall + MTGJSON | Recherche temps réel et imports bulk |
| ETL | Python | Ingestion/validation des dumps, hors runtime |

## Démarrage

Prérequis : Node.js 22.13+ et pnpm 10.20+.

```sh
corepack enable
pnpm install
pnpm typecheck
pnpm test
pnpm dev:mobile
pnpm dev:server
```

## Documentation et suivi

Reprise après interruption : **[docs/RESUME.md](docs/RESUME.md)**. Pour le détail : [index du projet](docs/PROJECT_INDEX.md). Il recense les spécifications, l'architecture, les règles, les références techniques, les décisions, la roadmap et le journal de suivi.

- [Spécification produit](docs/PRODUCT_SPEC.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Périmètre et couverture des règles](docs/RULES_SCOPE.md)
- [Roadmap et critères de sortie](docs/ROADMAP.md)
- [Sources de données](docs/DATA_SOURCES.md)
- [Références techniques locales](docs/references/README.md)
- [Guide mobile et réseau local](apps/mobile/README.md)

## État du prototype

Le socle du moteur, le plateau mobile, la recherche Scryfall et le cache SQLite existent. Le client peut créer/rejoindre une salle LAN et passer la priorité. Le serveur ne distribue pas encore de decks et le jeu n'est pas encore complet : consulter la roadmap et le journal avant de considérer une fonctionnalité comme livrée.

Projet indépendant, non affilié à Wizards of the Coast.
