# Analyse de développement — moteur de pile

## Tâche initiale
Créer un moteur de pile de référence utilisable par les sorts, capacités activées/déclenchées et copies.

## Analyse
- Le dépôt avait déjà un cycle partiel dans game.ts et un type StackItem dans le modèle. Le nouveau module extrait les primitives de cycle de vie plutôt que de créer une seconde représentation concurrente.
- Le payload reste opaque : le cycle de vie ne doit pas connaître le texte Oracle ou la sémantique des effets.
- Les passes de priorité, APNAP, choix, cibles, coûts et fenêtres de résolution restent dans le coordinateur jusqu'à ce que leurs contrats soient implémentés et testés.
- Risque restant : le module fournit le socle, mais GameState et le serveur ne sont pas encore entièrement migrés vers une orchestration centralisée.

## Amélioration de méthode
Pour les prochains changements, inventorier les fonctions existantes, les consommateurs et les règles applicables avant de déplacer du code. Garder compatibilité publique et ajouter des tests de cycle de vie isolés.

## 2026-11-17 — Registre et frontière de handlers typés

### Analyse
- Le contrat StackItem expose un payload unknown, tandis que le serveur injecte aujourd'hui un callback global. Ajouter un interpréteur universel ou un parseur Oracle ici mélangerait cycle de vie et sémantique des cartes.
- La tranche ajoute un registre générique par catégorie, dont les types de payload sont fournis par le système appelant. Chaque entrée valide le payload avant d'appeler son handler.
- L'exécution exige que l'objet soit exactement celui verrouillé au sommet. Elle ne retire pas l'objet : le coordinateur conserve la main sur SBA, triggers et priorité.
- Les états handler-unavailable et invalid-payload sont explicites et sans mutation ; ils ne doivent pas être convertis en succès silencieux.

### Limites et prochaine étape
- Le serveur n'est pas encore migré vers ce registre ; ses callbacks existants restent compatibles.
- Aucun payload métier ni parseur Oracle n'est ajouté dans le moteur partagé.
- Étape suivante : migrer une seule famille de stack item du serveur vers le registre, avec tests de rejeu et d'échec, puis généraliser après validation.


## 2026-11-17 — Première famille migrée vers le registre

### Décision
- Les triggers ETB sont la meilleure première migration : contrat serveur étroit, deux effets explicitement compilés et tests d'intégration existants qui vérifient leur timing.
- Le registre serveur décode sourceName, l'identifiant optionnel de changement de zone et le montant positif et sûr du gain de vie.
- Un payload d'une famille ETB reconnue mais mal formé échoue explicitement. Un autre type de trigger reste compatible avec le résolveur injecté historique.
- Les tests ETB sont renforcés avec un résolveur legacy qui lève une erreur s'il est appelé pour ces triggers.

### Portée et risques
- Le déplacement de la carte permanente, le retrait du trigger et la priorité restent orchestrés par GameRoom / resolveStackItem.
- Le registre n'effectue pas le retrait et ne change pas les fenêtres de priorité.
- Les capacités activées, les triggers non ETB, les copies et les sorts ne sont pas migrés.

### Validation
- CI run 44091022607 : typecheck, suite Vitest et tests python-data réussis sur le commit d'intégration e864f19730f4a2c8a5099d63c51add6e0aab2647.


## 2026-11-17 — Migration des sorts simples

- Deux modèles Oracle exacts déjà acceptés par supportsBasicSpell sont désormais décodés et exécutés via le registre : pioche de un/deux/trois cartes et gain d'un nombre de points de vie.
- Le contrat payload du handler ne transporte que l'effet compilé et son paramètre ; le décodeur inspecte oracleText runtime et rejette les montants non sûrs ou nuls.
- GameRoom ne route que les sorts non-permanents dont le texte correspond à ces modèles. Les permanents conservent leur branche de zone ; les effets inconnus restent sur le résolveur injecté.
- Les tests Divination et gain de vie empêchent explicitement l'appel du résolveur legacy pour les sorts.

### Retour CI et invariant conservé
- La première CI de migration des sorts a révélé que le dispatch typé retournait trop tôt et sautait le déplacement du sort résolu de la zone stack vers le cimetière.
- Correction : le coordinateur conserve explicitement cette transition après le retour du handler. Le handler reste limité à l'effet de carte ; il ne prend pas en charge le cycle de vie.
- Le test d'intégration avait détecté la régression sur Divination et le sort de gain de vie. Ce cas devient un invariant à préserver pour toute nouvelle famille de handlers.

### Validation finale de la tranche sorts
- CI run 44091756265 : typecheck, tests Vitest et python-data réussis sur f4347766bf957bcc89a4d78ffa95ff6dc0e93408. La régression de déplacement en zone a été corrigée et couverte par les tests Divination / gain de vie.
