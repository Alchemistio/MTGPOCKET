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

## Frontière de handlers typés

- Le registre associe chaque catégorie de StackItem à un décodeur de payload et à un handler typé.
- Le décodage est une validation runtime explicite : un payload invalide n'est jamais transmis au handler.
- L'absence de handler et le payload invalide sont des résultats distincts, sans retrait ni déverrouillage de l'objet.
- Le handler retourne un nouvel état immuable ; il ne retire pas l'objet de pile et ne distribue pas la priorité.
- Le coordinateur reste responsable du retrait, des SBA, des triggers et de la priorité après l'effet.
