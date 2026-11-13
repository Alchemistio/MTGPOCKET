# Journal de suivi du projet

## 2026-11-13 — Coordinateur de pré-partie autoritaire

- Ajout de `PregameCoordinator` côté serveur : réception d'une liste de deck par siège, validation à partir du catalogue et de la politique de légalité fournis par le serveur, expansion en instances runtime, placement des commandants, mélange et distribution des mains initiales.
- Coordination des déclarations de mulligan simultanées, génération des graines côté serveur, choix privés des cartes à remettre sous la bibliothèque et démarrage uniquement lorsque les quatre joueurs ont gardé.
- Les vues existantes masquent toujours l'identité des mains adverses ; tests de non-régression ajoutés pour la confidentialité et les refus de decks invalides.
- Correctifs CI : types Fetch nécessaires au module Scryfall utilisé par le serveur ; agrégation des lignes répétées d'un même identifiant de carte avant de créer les instances.
- CI GitHub Actions `43475390536`, commit `15ce2127251c62f46897ba85994f1436b7dbc7f7` : `validate` (typecheck + Vitest) et `python-data` réussis.
- Limite actuelle : le coordinateur est un service serveur testable, mais il n'est pas encore raccordé aux messages WebSocket/mobile. La politique d'éligibilité Commander reste une dépendance versionnée injectée par le serveur ; aucune légalité client n'est acceptée.
- Prochaine étape : exposer ces opérations via un protocole de pré-partie authentifié, avec réponses ciblées au joueur et tests d'intégration WebSocket.

## 2026-11-13 — Correction du mulligan londonien

- Correction : suppression de la limite arbitraire de huit mulligans ; les mulligans répétés restent possibles.
- Le nombre de cartes à remettre sous la bibliothèque est plafonné à la main réellement piochée et à la taille de main initiale.
- Ajout d'un test de non-régression couvrant neuf mulligans successifs et la conservation de l'état de préparation.
- CI GitHub Actions `43467356882`, commit `92422465ca7b2247d6bb6ffe7fd6eb1fed1b3151` : `validate` (typecheck + tests Vitest) et `python-data` réussis.
- Prochaine étape : intégrer les commandes de pré-partie au serveur LAN et le chargement des listes de decks sans exposer les mains adverses.

Journal append-only : ajouter une nouvelle entrée en tête, ne pas réécrire l'historique. Les commits et runs CI doivent pointer vers des identifiants vérifiables.

## 2026-11-13 — Consolidation documentaire et références

- Création de l'index documentaire, du journal, du registre ADR et des fiches locales de référence.
- Correction des liens de documentation et des marqueurs de mise en forme qui n'étaient pas du Markdown.
- Revue de cohérence de la matrice de règles avec le PDF Comprehensive Rules fourni (édition 2026-09-25), notamment mulligan multijoueur et retour du commandant.
- Sources techniques consultées : Expo SDK (SDK 58 / RN 0.88), expo-sqlite, politique API Scryfall, index de fichiers MTGJSON v5 et documentation Scrydex.
- La documentation complète des tiers n'est pas copiée lorsque la licence de redistribution n'est pas établie ; des fiches de synthèse locales et les URLs canoniques sont enregistrées.
- CI précédente observée verte : run GitHub Actions `43441612723` (jobs `validate` et `python-data`). Ce résultat porte sur le commit testé, pas automatiquement sur les commits documentaires ajoutés ensuite.
- À faire : exécuter la CI après cette mise à jour, et vérifier les fiches sur les appareils réels.

## 2026-11-13 — Fondation initiale (PR #1)

- Monorepo pnpm et packages partagés ; moteur TypeScript, application Expo, serveur WebSocket et import Python.
- Moteur : setup Commander, mulligan multijoueur, priorité/pile de base, étapes, nettoyage, pertes et validation initiale de deck.
- Mobile : plateau paysage quatre joueurs, recherche Scryfall, détail multi-face, cache SQLite, création/rejoindre salle LAN.
- Serveur : sièges, jetons, vues privées, révisions et première commande de passage de priorité.
- Import MTGJSON : extraction streaming vers SQLite avec provenance et checksum.
- Limites consignées dans la PR : pas encore de jeu complet, de deck partagé serveur, de moteur complet de cartes, de reconnexion ou de sécurité réseau de production.

## Format d'une entrée future

```md
## YYYY-MM-DD — Sujet
- Livré :
- Fichiers/modules :
- Tests réellement exécutés :
- Résultats CI / commit :
- Limites et risques :
- Prochaine étape :
```
