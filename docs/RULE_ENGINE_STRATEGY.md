# Stratégie de développement du Rules Engine

## Intention
Construire un moteur générique qui prend en charge un maximum de cartes à partir des règles et du texte Oracle, sans implémenter chaque carte individuellement. Cette stratégie complète les roadmaps existantes ; elle ne remplace ni fondation, ni réseau, ni mobile, ni autres priorités.

## Source et recherche
- Base texte et index : `Rules_Engine/`.
- Mémoire : `memory/`, avec un sous-dossier par domaine.
- Rechercher l'identifiant CR dans `Rules_Engine/index/rules_index.md`, lire le paragraphe source, puis suivre références et glossaire.
- Chaque édition CR a son manifest, son diff et une reconstruction vérifiée. Ne jamais mélanger deux éditions sans l'indiquer.

## Priorité à la mécanique générique
1. Règles et événements communs.
2. Modèles de données et transitions génériques.
3. Compilateur Oracle vers AST/IR.
4. Interpréteur d'effets avec cibles, choix, coûts, modes et durées.
5. Modules complets (ETB, coûts, remplacement, couches, combat, copies).
6. Tests sur corpus Scryfall/Oracle.
7. Exceptions rares, isolées et documentées.

Une carte devient supportée lorsqu'elle peut être compilée et exécutée par ces primitives. Ne pas écrire un handler par carte si la combinaison est déjà représentable.

## Architecture
Voir [architecture cible](../memory/rules/engine_architecture.md). La cible inclut lexing, grammaire, résolution des références, validation sémantique, IR typée, processeur d'événements autoritaire, interpréteur composable, couches, SBA, pile et priorité.

## Mesure de couverture
- Rule coverage : règles CR implémentées et testées.
- Parse coverage : formulations Oracle compilées.
- Semantic coverage : choix, cibles, zones, timing, remplacements et interactions.
- Execution coverage : effets résolus avec tests.
- Card coverage : cartes dont toutes les capacités sont supportées.
Ne pas confondre ces mesures. Aucun fallback silencieux pour un texte non supporté.

## Modules
Chaque mécanique complexe reçoit un dossier mémoire, une recherche, une roadmap complète et une matrice de tests. Exemple : [ETB](../memory/rules/etb/etb_index.md).

## Recherche externe
Ironsmith, Argentum et Majik ont été étudiés comme exemples de compilation Oracle, IR/AST, transitions déterministes, zones et événements. Ce sont des projets tiers, pas des autorités de règles. Wizards Comprehensive Rules reste la référence normative.
