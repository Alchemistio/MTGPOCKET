# Analyse de développement — moteur de couches

## Tâche initiale
Créer un moteur de couches générique servant de référence commune aux systèmes consommateurs.

## Analyse
- Le dépôt avait une fonction spécialisée de couche 4 pour les changements de types à l'entrée. La généraliser sans inventer une sémantique complète pour les autres couches aurait créé une fausse couverture.
- Décision : orchestrateur plugin 1–7, payload générique, contrat immuable, résultats distinguant appliqué et non supporté.
- CR 613.7 n'est pas réductible à un tri par timestamp. L'orchestrateur garde donc l'ordre d'entrée en cas d'égalité et documente que le résolveur de dépendances doit précéder l'évaluation.
- Risque restant : la tranche couche 4 existante n'est pas encore branchée comme plugin et l'orchestrateur n'effectue pas encore le recalcul de tous les permanents.

## Amélioration de méthode
Inspecter les consommateurs et les frontières avant d'ajouter une abstraction ; préférer un contrat extensible avec erreurs explicites à un moteur qui prétend tout gérer. Ajouter les limites à la roadmap au même commit que le squelette.
