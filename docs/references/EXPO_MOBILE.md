# Référence locale — Expo SDK et React Native

- **Vérifié :** 2026-11-13.
- **Source canonique :** https://docs.expo.dev/versions/latest/
- **État observé sur la documentation Expo :** SDK 58.0.0 cible React Native 0.88, React 19.3.0 et Node.js 22.13.x minimum. Le tableau de compatibilité indique Android 7+ et iOS 16.4+.
- **Choix du repo :** vérifier `apps/mobile/package.json` et `app.json` avant tout upgrade. Ne pas mélanger les versions d'Expo SDK et des modules natifs.

## Règles de maintenance

1. Utiliser `npx expo install`/l'équivalent pnpm pour les modules Expo afin de résoudre une version compatible avec le SDK installé.
2. Après une mise à niveau SDK : `pnpm install`, `pnpm typecheck`, `pnpm test`, `npx expo-doctor`, puis builds iOS/Android.
3. Une CI TypeScript verte ne valide pas les modules natifs, les permissions OS, les orientations ni le rendu sur appareil.
4. Vérifier les minimums iOS/Android et exigences des stores au moment de chaque release.

## Documents utiles

- Expo SDK reference : https://docs.expo.dev/versions/latest/
- Expo app config : https://docs.expo.dev/workflow/configuration/
- Expo orientation : https://docs.expo.dev/versions/latest/sdk/screen-orientation/
- React Native : https://reactnative.dev/docs/getting-started

## Licence / copie locale

Cette fiche est une synthèse interne. Le contenu intégral du site Expo n'est pas copié ; consulter la documentation officielle pour les API détaillées et les changements postérieurs au 2026-11-13.
