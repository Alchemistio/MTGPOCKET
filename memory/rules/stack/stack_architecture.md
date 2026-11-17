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

## Première intégration serveur

- Le serveur utilise le registre typé pour les deux payloads ETB compilés : pioche d'une carte et gain de vie.
- Un ETB reconnu mais mal formé est rejeté ; il n'est pas silencieusement transmis à un résolveur alternatif.
- Les familles de capacités inconnues continuent d'utiliser le résolveur injecté historique.
- Les sorts et leur pipeline de déplacement de zone restent inchangés dans cette tranche.

## Migration des sorts simples

- Les sorts instantanés/rituels avec les modèles exacts « Draw a/two/three cards. » et « You gain N life. » sont décodés par le registre typé.
- Le décodeur impose un montant de vie entier strictement positif et sûr ; les effets inconnus restent au résolveur injecté.
- Les sorts permanents gardent leur branche dédiée de déplacement de zone et de remplacements d'entrée.

## Transaction d'activation — première tranche

- `activateStackAbility` est un contrat moteur atomique pour une capacité activée qui utilise la pile.
- Contrôles : catégorie `activated-ability`, cohérence source/contrôleur, source sur le champ de bataille et contrôlée par l'activateur, priorité et invariants génériques de pile.
- Coûts pris en charge : mana générique numérique, mana coloré/hybride simple non pris en charge, symbole colorless `C`, et engagement optionnel de la source.
- Le paiement, l'engagement et l'ajout en pile produisent une seule incrémentation de révision ; les échecs ne mutent pas l'état.
- Les capacités de mana restent sur leur voie immédiate sans pile (ex. `tap-for-mana`) et ne doivent pas être routées dans cette transaction.
- Ce contrat ne compile pas Oracle et ne décide pas de la légalité/timing propres à la capacité ; le coordinateur doit fournir une activation déjà annoncée et validée.
- Sacrifice, défausse, paiement de points de vie, coûts alternatifs/additionnels, restrictions d'activation et mal d'invocation restent non pris en charge.
