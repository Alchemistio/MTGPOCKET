# ETB — recherche normative et technique

Date : 16 novembre 2026. Référence normative la plus récente consultée : Comprehensive Rules effectives au 6 novembre 2026. L'index local détaillé reste basé sur la version fournie du 25 septembre ; vérifier les changements de version.

## 1. Définition et distinctions
Un ETB n'est pas un simple callback après ajout au battlefield. C'est une famille de zone-change triggers (CR 603.6).
- **Triggered ETB** : se déclenche lorsqu'un permanent entre ; tous les permanents sur le champ de bataille, entrants compris, sont vérifiés (603.6a).
- **Entrée modifiée/statique** : « enters tapped », « enters with », « as this enters » n'est pas un trigger ; l'effet fait partie de l'événement d'entrée (603.6d) et peut relever de 614.12.
- **Effets continus** : les caractéristiques sont modifiées dès que le permanent est sur le champ de bataille ; une capacité peut donc être accordée/retirée au moment pertinent (603.6b, 113.6).
- **Zone change** : identité d'objet, zone de destination et informations avant/après sont essentielles (603.6, 400.7).

## 2. Règles à intégrer
- Une capacité ne se déclenche que si l'événement arrive réellement ; un événement remplacé/prévenu ne déclenche rien (603.2g).
- Une capacité déclenche une fois par occurrence ; un événement composite peut contenir plusieurs occurrences (603.2c).
- Le contrôleur est celui de la source au moment du déclenchement (603.3a).
- Le trigger est mis sur la pile la prochaine fois qu'un joueur devrait recevoir la priorité (603.3).
- Plusieurs triggers sont empilés selon le processus APNAP en deux groupes, avec ordre choisi par chaque joueur (603.3b), puis SBA et triggers induits sont traités avant la priorité.
- Modes/choix/cibles et légalité doivent être traités au placement sur la pile (603.3c–d).
- Intervening-if est vérifié au trigger puis à la résolution (603.4).
- « May » : le trigger est mis sur la pile même si le contrôleur prévoit de refuser ; choix à la résolution (603.5).
- Déclenchements retardés et réflexifs ont leurs propres règles (603.7, 603.12).
- Sources hors battlefield, LKI et références d'objet imposent de modéliser les zones et références (113.6, 603.6c, 603.10–603.11, 400.7).

## 3. Entrée et remplacements
Avant la détection, traiter les effets qui changent la façon dont un permanent entre. 614.12 et 616.1 demandent de déterminer les remplacements applicables à partir des caractéristiques pertinentes du permanent tel qu'il existerait sur le battlefield, en tenant compte des remplacements déjà appliqués et des effets continus pertinents. Certains choix doivent être faits avant l'entrée (614.12a). Un mouvement direct de carte depuis l'UI vers le battlefield contournerait ces règles et doit être interdit.

## 4. Pipeline recommandé
1. Recevoir une intention (résolution de sort, token, réanimation, blink, copie, effet de terrain/permanent).
2. Construire un événement de zone proposé avec source, owner/controller, zones, groupe simultané et cause.
3. Appliquer remplacements et choix « as enters » ; si l'événement n'a pas lieu, aucun ETB.
4. Commit le mouvement et gérer la nouvelle identité d'objet (400.7), avec informations antérieures utiles.
5. Recalculer caractéristiques/couches.
6. Scanner toutes les capacités pertinentes de tous les permanents, entrants compris, pour chaque occurrence (603.6a).
7. Évaluer conditions et intervening-if ; créer des candidats avec source, LKI et contrôleur capturés.
8. Exécuter les SBA au checkpoint requis et collecter les triggers induits.
9. Mettre les triggers sur la pile selon 603.3/603.3b, modes/cibles et ordre APNAP.
10. Ouvrir la priorité ; la source peut avoir quitté le battlefield, sans que cela efface automatiquement la capacité sur la pile.

Les notifications UI/journal sont postérieures à la décision métier ; l'EventBus d'observation ne décide pas si un trigger existe.

## 5. Modèle à envisager
- `ZoneChangeEvent` : eventId, simultaneousGroupId, instance before/after, from/to zone, owner, controller before/after, cause, replacementTrace, lastKnownInfo.
- `TriggerCandidate` : sourceRef, controllerAtTrigger, triggerDefinitionId, eventRef, conditionSnapshot, targets/modes, effectIR, sourceLki.
- `PendingTriggerBatch` : candidats groupés par checkpoint et joueur ; APNAP et ordre choisi conservés.
- `StackItem` : IR/texte figé, contrôleur, cibles/modes/choix, source/LKI et identifiant déterministe.
Ces types sont des propositions, pas des types déjà présents dans le code.

## 6. Recherche externe
- Ironsmith : https://github.com/Chiplis/ironsmith — compilation Oracle en phases et moteur déterministe.
- Argentum : https://github.com/ITC-MSM/commander/blob/main/docs/architecture-principles.md — AST/IR, effets composables et transitions fonctionnelles.
- Majik : https://github.com/bg9m9r/majik — event bus, événements métier, gestion des zones et registre de capacités.
Ces projets tiers ne sont ni des règles officielles ni une preuve de correction. Wizards CR prime.
