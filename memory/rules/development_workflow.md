# Boucle d'analyse et d'amélioration du développement

À appliquer à chaque tâche de développement Commander Pocket.

## Avant
1. Reformuler le résultat attendu et les critères d'acceptation.
2. Lire la roadmap, le journal, l'architecture et les analyses mémoire du module.
3. Vérifier HEAD, PR, CI, consommateurs et contrats existants.
4. Consulter les Comprehensive Rules indexées quand la sémantique normative est concernée.
5. Identifier les risques, dépendances, hypothèses et tests négatifs avant le code.

## Pendant
1. Découper en tranches verticales cohérentes.
2. Après chaque tranche, relire le diff et rechercher les consommateurs impactés.
3. Vérifier si une abstraction existe déjà avant d'en créer une seconde.
4. Garder les fonctions pures/déterministes et les effets externes injectés.
5. Faire apparaître les comportements non supportés dans les types/résultats plutôt que les ignorer.
6. Ajouter les tests de non-mutation, d'erreur, de rejeu et de régression appropriés.

## Après
1. Consigner décisions, alternatives rejetées, limites et résultats de tests dans `memory/rules/<module>/development_analysis.md`.
2. Mettre à jour roadmap, index, matrice de tests, journal et résumé de reprise selon l'impact.
3. Vérifier la CI du SHA exact et distinguer CI, simulateur et appareils physiques.
4. Ajouter une leçon de méthode seulement si elle est réutilisable ; éviter les notes redondantes.
5. À la tâche suivante, relire la dernière analyse et appliquer les améliorations identifiées.

## Métriques de qualité
- Couverture des invariants et erreurs négatives.
- Nombre de systèmes consommateurs utilisant le contrat commun.
- Écart entre règles normatives, implémentation et tests.
- Régressions de typecheck/CI.
- Nombre de handlers carte-spécifiques évités sans sacrifier la clarté.
