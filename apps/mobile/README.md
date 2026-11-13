# Application mobile

React Native + Expo SDK 58 + TypeScript. SDK 58 cible React Native 0.88 et React 19.3 ; son outillage demande Node 22.13+ (ou Node 24.3+). Le dépôt utilise pnpm.

## Lancer

```sh
pnpm install
pnpm dev:mobile
```

Le prototype démarre en paysage et se connecte au package partagé `@commander-pocket/game-engine`. Les quatre sièges affichent la vie, la main, la taxe de commandant et le mana ; le joueur ayant la priorité peut la passer, ce qui fait circuler la fenêtre et avancer l'étape quand tous ont passé.

Le plateau et les boutons de priorité sont une première tranche jouable de démonstration. Les decks, mains réelles, effets de cartes, pile résolue, réseau et tiroir interactif restent à connecter. Le verrouillage d'orientation sera rendu conditionnel par écran lorsque les vues portrait (collection/deckbuilding) seront ajoutées.
