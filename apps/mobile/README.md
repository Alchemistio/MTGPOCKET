# Application mobile

React Native + Expo SDK 58 + TypeScript. SDK 58 cible React Native 0.88 et React 19.3 ; son outillage demande Node 22.13+ (ou Node 24.3+). Le dépôt utilise pnpm.

## Lancer

```sh
pnpm install
pnpm dev:mobile
```

L'application est configurée en paysage. Le prototype présente les quatre sièges avec vie, taille de main, taxe de commandant et mana, ainsi qu'un panneau compact pour les zones. Il inclut la recherche Scryfall, le détail des cartes multi-face et un cache SQLite via `createMobileCardRepository()`.

Le flux LAN expose la création/rejoindre de salle, les jetons de siège, les vues privées, le modal de pré-partie (deck, keep/mulligan, bottom, start), la main privée, les sorts simples explicitement supportés, la défausse de cleanup et le tiroir de pile. Le serveur reste l'autorité ; le client ne construit jamais l'état de partie partagé.

## Connexion LAN

1. Sur un ordinateur du même Wi-Fi, lancer `pnpm dev:server` (port 3000).
2. Récupérer son adresse IP locale et la saisir dans l’écran **RÉSEAU** sous la forme `ws://IP:3000/ws`.
3. L’hôte crée une salle et partage à chaque joueur son identifiant de salle, son siège et son jeton privé.
4. Les autres joueurs choisissent **REJOINDRE** et saisissent leurs identifiants de siège.
5. Le serveur distribue une vue dédiée à chaque siège ; les mains adverses et les seeds restent privées.

### Reconnexion

Tant que l'application mobile reste active, `RoomClient` effectue jusqu'à cinq tentatives avec délai exponentiel après une perte WebSocket. Il réutilise le jeton de siège conservé en mémoire, renvoie `join-room` et remplace la vue locale par la vue autoritaire reçue du serveur. Cela permet de récupérer une salle si le serveur redémarre et recharge son répertoire de persistance.

Après fermeture complète ou redémarrage de l'application mobile, la session et le jeton ne sont pas restaurés automatiquement : le joueur doit rejoindre de nouveau la salle avec son jeton. La découverte LAN reste à implémenter.

## Limites

- Pas de découverte automatique LAN ni de TLS/gestion de secrets de production.
- Reconnexion automatique limitée à la durée de vie du processus mobile et à cinq essais.
- Le serveur n'interprète que les effets de cartes explicitement supportés ; le moteur ne couvre pas encore toutes les Comprehensive Rules.
- Catalogue Scryfall réel et policy Commander de production à provisionner côté serveur.
- Aucun test sur appareils physiques ou réseau Wi-Fi réel n'est revendiqué.
