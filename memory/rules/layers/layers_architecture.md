# Architecture — moteur de couches

## Contrat
- Entrée immuable : permanent évalué, caractéristiques initiales, contexte de règles et sources valides.
- Effets continus normalisés : identifiant stable, couche 1–7, source, timestamp, payload typé.
- Plugins indépendants par couche : reçoivent les caractéristiques produites par les couches précédentes.
- Sortie : caractéristiques calculées, identifiants appliqués et identifiants explicitement non pris en charge.
- Aucun plugin absent ne peut être traité comme un effet ignoré : l'identifiant reste visible dans `unsupportedEffectIds`.

## Ordre et dépendances
L'orchestrateur traverse les couches 1 à 7 et préserve l'ordre fourni en cas d'égalité de timestamp. Le déterminisme du tri ne remplace pas CR 613.7 : le détecteur de dépendances et le résolveur d'ordre sont des composants distincts à construire. Le moteur ne déduit pas les dépendances à partir des seuls sélecteurs.

## Frontières
Le moteur ne parse pas Oracle, ne lit pas Scryfall, ne modifie pas GameState et ne décide pas des règles de sélection de cible. Les compilateurs/registries fournissent les effets structurés. Le calcul d'un entrant (614.12) et le recalcul global des permanents devront réutiliser le même contrat sans confondre les deux contextes.
