# Architecture — moteur de pile

## Contrat d'objet
Chaque objet possède un id stable, contrôleur, source d'instance éventuelle, catégorie (sort, capacité activée, capacité déclenchée, copie) et payload opaque/versionné. Le payload n'est pas exécuté par le moteur de cycle de vie.

## Responsabilités du moteur
- Valider le contrôleur, la priorité, l'état de partie, l'unicité d'id et la présence d'une carte de sort en zone de pile.
- Ajouter un objet en haut de pile et réinitialiser les passes.
- Lire le sommet et verrouiller l'objet dont la résolution est autorisée.
- Retirer uniquement l'objet attendu après l'exécution de son effet.
- Laisser la résolution de l'effet à un handler/interpréteur injecté.
- Laisser priorité, APNAP, choix, cibles, coûts et timing au coordinateur de règles tant que leurs contrats dédiés ne sont pas complets.

## Invariants
- LIFO strict ; un seul objet en résolution.
- Aucun ajout pendant une résolution.
- Un identifiant ne peut pas être réutilisé dans une même pile.
- Seul le contrôleur ayant la priorité ajoute un objet via ce contrat initial.
- Les fonctions de cycle de vie sont déterministes et pures.
