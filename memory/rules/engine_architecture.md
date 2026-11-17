# Architecture cible du Rules Engine

Statut : proposition à valider progressivement par ADR et tests.

## Objectif
Faire dépendre le comportement des cartes d'une représentation structurée de leur texte Oracle et d'un moteur générique. Éviter les handlers carte par carte ; garder les exceptions rares, explicites et isolées.

## Pipeline cible
1. Données Scryfall unifiées : `oracle_id`, `layout`, `type_line`, coûts, couleurs, identité couleur, légalité, `oracle_text`, `card_faces[]`.
2. Lexing Oracle : symboles, ponctuation, mots-clés, verbes de règles et expressions de timing.
3. Parsing grammatical : clauses, coûts, conditions, cibles, modes, durées et quantificateurs.
4. Résolution des références : « this », « it », « that creature », objet source, contrôleur/propriétaire et objets précédemment choisis.
5. Validation sémantique : zones, types, cibles, valeurs et coûts au regard de la CR.
6. Lowering vers une IR typée et versionnée : TriggerSpec, CostSpec, TargetSpec, ChoiceSpec, EffectNode, DurationSpec, ReplacementSpec, ContinuousEffectSpec.
7. Interpréteur d'effets composables : pioche, vie, dégâts, mouvement de zone, tokens, marqueurs, attachement, tap/untap, copie, etc.
8. Moteur de règles : événements, remplacements/préventions, SBA, couches, pile, priorité et APNAP.
9. Projection mobile/serveur : vues publiques/privées dérivées de l'état autoritaire.

## Pipeline d'événements
Séparer le processeur métier de l'EventBus d'observation. Le processeur reçoit une intention, applique remplacements et choix, commit la transition, recalcule les caractéristiques, détecte les triggers, exécute les SBA et place les capacités sur la pile selon le timing CR. Les notifications UI/journal sont émises ensuite. Le bus d'observation ne décide jamais des règles.

## Couverture
- Les capacités sont compilées en déclaratif ; aucun texte Oracle arbitraire n'est exécuté.
- Les capacités non comprises sont explicitement non supportées, jamais ignorées silencieusement.
- Matrice CR → composant → test et corpus Scryfall par motif grammatical.
- Mesurer rule/parse/semantic/execution/card coverage séparément.
- Déterminisme, invariants, simultanéité, persistance et rejeu testés.

## Recherche externe
- [Ironsmith](https://github.com/Chiplis/ironsmith) : lexing, grammaire, résolution de références, compilation runtime et moteur déterministe.
- [Argentum — principes](https://github.com/ITC-MSM/commander/blob/main/docs/architecture-principles.md) : AST/IR, effets composables, transitions fonctionnelles et couches.
- [Majik](https://github.com/bg9m9r/majik) : séparation événements métier/observation, gestion des zones, capacités et mots-clés.
Ces projets sont des références d'architecture tierces, pas des autorités normatives ni des preuves de conformité.
