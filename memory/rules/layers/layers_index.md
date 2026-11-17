# Moteur de couches — index mémoire

Statut : squelette générique initial, couverture normative partielle.

- [Architecture](layers_architecture.md)
- [Roadmap](layers_roadmap.md)
- [Analyse de développement](development_analysis.md)

Point d'entrée runtime : `packages/game-engine/src/layer-engine.ts`.
Le moteur orchestre les couches 1–7, délègue chaque couche à un plugin typé et signale explicitement les effets non pris en charge. Le calcul actuellement implémenté dans le dépôt reste limité à une tranche de couche 4 documentée dans `continuous-effects.ts`. Il ne s'agit pas encore d'une implémentation complète de CR 613.
