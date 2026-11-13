# Application mobile

React Native + Expo SDK 58 + TypeScript. SDK 58 cible React Native 0.88 et React 19.3 ; son outillage demande Node 22.13+ (ou Node 24.3+). Le dépôt utilise pnpm.

## Lancer

```sh
pnpm install
pnpm dev:mobile
```

Le prototype démarre en paysage et se connecte au package partagé `@commander-pocket/game-engine`. Les quatre sièges affichent la vie, la main, la taxe de commandant et le mana ; le joueur ayant la priorité peut la passer, ce qui fait circuler la fenêtre et avancer l'étape quand tous ont passé.

Le cache des cartes est persistant via expo-sqlite : `createMobileCardRepository()` compose le client Scryfall avec SQLite, des TTL et une déduplication des requêtes. Le module est prêt, mais le flux de recherche dans l’interface reste à brancher.\n\nLe plateau et les boutons de priorité sont une première tranche jouable de démonstration. Les decks, mains réelles, effets de cartes, pile résolue, réseau et tiroir interactif restent à connecter. Le verrouillage d'orientation sera rendu conditionnel par écran lorsque les vues portrait (collection/deckbuilding) seront ajoutées.

## Connexion LAN (prototype)
1. Sur un ordinateur du même Wi-Fi, lancer `pnpm dev:server` (port 3000).
2. Récupérer son adresse IP locale et la saisir dans l’écran **RÉSEAU** sous la forme `ws://IP:3000/ws`.
3. L’hôte crée une salle ; il partage l’identifiant de salle, le siège et le jeton privé de chaque joueur.
4. Les autres joueurs choisissent **REJOINDRE** et saisissent leurs identifiants de siège.
5. Le plateau reçoit les vues privées et permet de passer la priorité lorsque c’est le tour du siège connecté.

Limites actuelles : pas de découverte automatique, de reconnexion ni de chiffrement/authentification de production ; seule la commande de passage de priorité est activée côté serveur.
