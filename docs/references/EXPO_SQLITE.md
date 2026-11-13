# Référence locale — expo-sqlite

- **Vérifié :** 2026-11-13.
- **Source canonique :** https://docs.expo.dev/versions/latest/sdk/sqlite/
- **Version recommandée observée :** ~58.0.17 (SDK Expo 58).
- **Fonction :** base SQLite persistante entre redémarrages, disponible sur iOS, Android et Web avec des différences de configuration.

## Points à appliquer

- Ouvrir la base avec `openDatabaseAsync` ou utiliser `SQLiteProvider` avec `onInit` pour les migrations.
- Versionner les migrations via `PRAGMA user_version`.
- Préférer les requêtes paramétrées (`runAsync(sql, ...params)`) ; `execAsync` n'échappe pas les paramètres.
- WAL est recommandé pour de meilleures performances générales.
- Pour les transactions, connaître les différences entre `withTransactionAsync` et `withExclusiveTransactionAsync`, notamment les connexions et clés étrangères.
- Le plugin de configuration peut activer SQLCipher ou FTS ; ces options natives nécessitent un nouveau binaire.
- Les requêtes lourdes synchrones peuvent bloquer le thread JavaScript.

## Application Commander Pocket

- Cartes consultées, résultats de recherche, decks, collections et snapshots de parties sont des tables distinctes.
- Ne pas stocker les images de cartes binaires dans la base par défaut : stocker URL/provenance/cache local géré séparément.
- Ajouter migrations, index, contraintes et tests de migration avant d'étendre le schéma.
- Les jetons LAN et secrets ne doivent pas être écrits en clair dans les logs.

Cette fiche est une synthèse de travail, pas une copie du manuel Expo.
