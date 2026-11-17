# Analyse de développement — moteur de couches

## Tâche initiale
Créer un moteur de couches générique servant de référence commune aux systèmes consommateurs.

## Analyse précédente
- Le dépôt avait une fonction spécialisée de couche 4 pour les changements de types à l'entrée. La généraliser sans inventer une sémantique complète pour les autres couches aurait créé une fausse couverture.
- Décision : orchestrateur plugin 1–7, payload générique, contrat immuable, résultats distinguant appliqué et non supporté.
- Le moteur principal préserve l'ordre reçu. Le tri timestamp seul ne suffit pas à représenter les dépendances.

## Tranche actuelle — ordonnanceur CR 613.8
- Correction normative : 613.7 traite du timestamp ; la dépendance est définie en 613.8.
- Implémentation d'un ordonnanceur dynamique générique. Le moteur ne déduit pas le prédicat à partir du texte Oracle : il est injecté et reçoit l'état courant afin de refléter les changements de dépendance.
- Après chaque effet, les dépendances des effets restants sont recalculées (613.8c). Si un cycle terminal est détecté, ses membres sont appliqués par timestamp et les effets qui dépendent du cycle restent en attente (613.8b).
- Les effets doivent être fournis par groupe de couche/sous-couche ; les effets CDA ne sont comparés qu'aux effets CDA, et les non-CDA aux non-CDA (613.8a).
- Tests ajoutés : ordre dépendance vs timestamp, dépendance qui apparaît après une application, SCC cyclique avec effet en aval, séparation CDA, validation et non-mutation.

## Limites et risques
- Les prédicats sémantiques de dépendance ne sont pas encore produits par les compilateurs de cartes/effets ; un prédicat incorrect invaliderait l'ordre. Le helper est donc une primitive de référence, pas une détection complète Oracle.
- Les timestamps 613.7a–n ne sont pas encore générés automatiquement.
- La tranche couche 4 n'est pas encore raccordée à cet ordonnanceur, et le recalcul global de tous les permanents reste à faire.
- Le traitement d'un SCC entier par timestamp doit être conservé comme politique explicite et couvert par des cas de règles supplémentaires avant usage sur toutes les familles.

## Amélioration de méthode
Vérifier les numéros de règles dans le texte source plutôt que de se fier aux notes précédentes ; corriger roadmap et architecture dans le même commit que le changement runtime. Séparer clairement l'ordonnanceur de la détection sémantique de dépendance.
