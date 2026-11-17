# Moteur de couches — index mémoire

Statut : squelette générique et primitive d'ordonnancement CR 613.8 ; couverture normative partielle.

- [Architecture](layers_architecture.md)
- [Roadmap](layers_roadmap.md)
- [Analyse de développement](development_analysis.md)

Entrées runtime :
- `packages/game-engine/src/layer-engine.ts` : pipeline plugin 1–7.
- `packages/game-engine/src/dependency-order.ts` : application ordonnée avec réévaluation des dépendances 613.8.

Le prédicat sémantique de dépendance est fourni par l'appelant ; les prédicats de cartes/effets et la génération des timestamps restent à construire. Le calcul des caractéristiques reste limité à la tranche couche 4 décrite dans `continuous-effects.ts`. Ce n'est pas encore une implémentation complète de CR 613.
