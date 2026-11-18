# Architecture — moteur de couches

## Contrat
- Entrée immuable : permanent évalué, caractéristiques initiales, contexte de règles et sources valides.
- Effets continus normalisés : identifiant stable, couche/sous-couche, source, timestamp, payload typé.
- Plugins indépendants par couche : reçoivent les caractéristiques produites par les couches précédentes.
- Sortie : caractéristiques calculées, identifiants appliqués et identifiants explicitement non pris en charge.
- Aucun plugin absent ne peut être traité comme un effet ignoré : l'identifiant reste visible dans `unsupportedEffectIds`.

## Ordre et dépendances (CR 613.7–613.8)
- CR 613.7 définit les timestamps ; le plus ancien est appliqué avant le plus récent lorsque le système de dépendance ne change pas cet ordre.
- CR 613.8 définit la dépendance : même couche/sous-couche, changement par l'autre effet du texte/existence, de l'ensemble affecté ou de ce que l'effet fait, et compatibilité CDA (les deux CDA ou aucun).
- `dependency-order.ts` reçoit un prédicat sémantique `dependsOn(effect, other, state)` fourni par le compilateur/résolveur. Il ne prétend pas déduire la sémantique Oracle à partir des sélecteurs génériques.
- L'ordonnanceur recalcule le graphe après chaque application (613.8c), choisit parmi les effets sans dépendance en attente par timestamp, et traite un SCC cyclique terminal par timestamp (613.8b). Les effets en aval d'un cycle restent en attente.
- Les effets transmis à cet ordonnanceur doivent appartenir à une seule couche/sous-couche. Le moteur principal traverse toujours les couches 1–7.
- La tranche couche 4 actuelle détermine la dépendance pour ses propres sélecteurs/opérations structurés : elle détecte le changement d'applicabilité et le changement des valeurs effectivement ajoutées/retirées.
- Les autres familles d'effets doivent fournir leur propre prédicat sémantique ; ne pas extrapoler ce détecteur type-changing à Oracle arbitraire.

## Frontières
Le moteur ne parse pas Oracle, ne lit pas Scryfall, ne modifie pas GameState et ne décide pas de la sélection de cible. Les compilateurs/registries fournissent les effets structurés et le prédicat de dépendance. Le calcul d'un entrant (614.12) et le recalcul global des permanents devront réutiliser le même contrat sans confondre les deux contextes.
