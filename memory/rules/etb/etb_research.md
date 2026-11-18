# ETB — recherche normative et technique

Date : 16 novembre 2026. Référence normative et index consultés : Comprehensive Rules effectives au 6 novembre 2026. La version du 25 septembre 2026 fournie dans le projet est conservée comme archive. Source officielle : https://magic.wizards.com/en/rules ; PDF : https://media.wizards.com/2026/downloads/MagicCompRules%2020261106.pdf.

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

## 6. Règles précises à garder dans la matrice de conformité
- 603.6a : tous les permanents présents, y compris les nouveaux entrants, sont examinés pour chaque événement qui met un ou plusieurs permanents sur le champ de bataille.
- 603.6b : les effets continus qui modifient les caractéristiques s'appliquent dès que le permanent est sur le champ de bataille ; ils peuvent donc changer si la capacité ETB existe au moment pertinent.
- 603.6d : « enters tapped/with », « as this enters » et « enters as » sont des capacités statiques dont l'effet fait partie de l'événement d'entrée, pas des triggers.
- 113.6h : les capacités qui modifient la manière dont leur propre objet entre fonctionnent pendant l'entrée ; 113.6k couvre les conditions de déclenchement qui ne peuvent pas déclencher depuis le champ de bataille.
- 614.12 / 614.12a : déterminer les remplacements à partir des caractéristiques que le permanent aurait sur le champ de bataille ; les choix requis sont faits avant l'entrée.
- 117.5 : avant qu'un joueur reçoive la priorité, traiter les SBA, puis les triggers, et répéter jusqu'à stabilisation.
- 400.7 : un objet qui change de zone devient un nouvel objet, sous réserve des exceptions listées.

## 7. Recherche externe
- Wizards Comprehensive Rules (référence normative) : https://magic.wizards.com/en/rules ; version 2026-11-06 : https://media.wizards.com/2026/downloads/MagicCompRules%2020261106.pdf.
- Magic Judges — classe 7 sur les capacités déclenchées : https://blogs.magicjudges.org/judgeclasses/english/class-7-en/.
- FAQ Magic Rules Tips — triggers simultanés et APNAP : https://blogs.magicjudges.org/rulestips/faq/.
- Ironsmith : https://github.com/Chiplis/ironsmith — compilation Oracle en phases et moteur déterministe.
- Argentum : https://github.com/ITC-MSM/commander/blob/main/docs/architecture-principles.md — AST/IR, effets composables et transitions fonctionnelles.
- Majik : https://github.com/bg9m9r/majik — event bus, événements métier, gestion des zones et registre de capacités.
Ces projets tiers ne sont ni des règles officielles ni une preuve de correction. Wizards CR prime.


## Reprise d'un choix de remplacement — tranche moteur (2026-11-18)

Le PDF Comprehensive Rules fourni (édition 2026-09-25) confirme les points normatifs vérifiés pour cette tranche : 614.5 (un remplacement ne s'applique pas répétitivement au même événement), 614.6 (l'événement original n'a pas lieu si remplacé), 616.1 (le joueur concerné choisit selon les catégories), 616.1f (répéter le processus en tenant compte des effets désormais applicables) et 616.1g (les événements contenus dans un événement remplacé ne sont traités qu'après le choix de l'événement englobant). Les règles 614.12 et 614.12a imposent en outre de déterminer les remplacements d'entrée à partir des caractéristiques pertinentes et de faire les choix requis avant l'entrée.

La fonction `resumeZoneChangeWithReplacements` permet au moteur de poursuivre la même session et sa trace après un choix, y compris si une nouvelle catégorie exige un second choix. La révision de partie reste le garde-fou contre une session devenue périmée. Cette tranche ne traite pas les choix imbriqués de 616.1g ni leur transport réseau.


## 8. Suspension serveur et protocole de décision — 2026-11-18

Le protocole de la salle ajoute `resolve-zone-change-replacement` avec `{ pendingId, effectId }`. Le client ne transmet jamais la proposition, la session, le contrôleur ou les fonctions d'effet : ces éléments restent autoritatifs côté serveur.

Pour un sort permanent dont les remplacements concurrents demandent un choix, la résolution est suspendue après le passage de priorité :
- `awaitingResolutionId` et le stack item restent actifs ;
- la carte source reste en zone `stack` ;
- aucun événement de changement de zone n'est commis et aucun trigger ETB n'est créé ;
- `GameState.pendingZoneChangeChoice` conserve les données sérialisables nécessaires à la reprise ;
- les fonctions de remplacement sont réhydratées depuis le résolveur serveur, pas stockées dans l'état ;
- la vue du choix et des candidats n'est envoyée qu'au contrôleur du permanent entrant ;
- chaque réponse successive incrémente la révision et réécrit `session.stateRevision` avant de pouvoir reprendre ;
- le journal des commandes acceptées permet de rejouer une partie et de restaurer une décision encore en attente.

Cette implémentation est un contrat mono-événement/mono-décideur. Elle ne prétend pas implémenter les choix APNAP simultanés de 616.1, les événements imbriqués de 616.1g, ni un moteur de détection des remplacements globaux. Le registre injectable `EntryReplacementResolver` fournit un point d'intégration testable pour les futurs effets de permanents.
