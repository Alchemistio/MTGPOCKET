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
- Les tests Divination et gain de vie utilisent un résolveur legacy qui échoue si le handler historique reçoit ces sorts.

### Retour CI et invariant conservé
- La première CI de migration des sorts a révélé que le dispatch typé retournait trop tôt et sautait le déplacement du sort résolu de la zone stack vers le cimetière.
- Correction : le coordinateur conserve explicitement cette transition après le retour du handler. Le handler reste limité à l'effet de carte ; il ne prend pas en charge le cycle de vie.
- Le test d'intégration avait détecté la régression sur Divination et le sort de gain de vie. Ce cas devient un invariant à préserver pour toute nouvelle famille de handlers.

### Validation finale de la tranche sorts
- CI run 44091756265 : typecheck, tests Vitest et python-data réussis sur f4347766bf957bcc89a4d78ffa95ff6dc0e93408. La régression de déplacement en zone a été corrigée et couverte par les tests Divination / gain de vie.

## 2026-11-17 — Transaction atomique d'activation sur pile

### Analyse préalable
- Le modèle `StackItem` déclarait déjà `activated-ability`, mais aucune primitive ne regroupait l'annonce, les coûts simples et l'empilement.
- Le serveur possède déjà `tap-for-mana` et `tapPermanentForMana`. Cette voie produit immédiatement du mana et ne doit pas être confondue avec une capacité activée qui utilise la pile.
- Le catalogue de cartes ne fournit pas encore de contrat structuré d'activation ; compiler des capacités depuis Oracle ou ajouter une commande serveur maintenant aurait supposé des données et règles absentes.

### Décision
- Ajout de `activateStackAbility` dans le moteur partagé : source battlefield contrôlée par l'activateur, objet pile cohérent, priorité/contrat d'empilement, paiement des symboles WUBRGC et génériques numériques, engagement optionnel de la source.
- Le paiement, l'engagement et l'ajout sont une transaction pure atomique avec une seule incrémentation de révision.
- Les coûts inconnus ou non supportés échouent explicitement ; le payload d'effet reste opaque et sera traité par un handler typé séparé.
- Les capacités de mana gardent le chemin immédiat existant ; aucune pile n'est créée pour elles.

### Limites
- Aucun dispatch serveur ni commande `activate-ability` n'est ajouté : il manque une définition structurée des capacités, leur légalité, timing, choix et conditions.
- Sacrifice, défausse, paiement de PV, coûts alternatifs/additionnels, restrictions d'activation, mal d'invocation, loyauté et mana abilities génériques ne sont pas couverts.
- Les symboles hybrides, phyrexians et variables ne sont pas supportés.

### Tests et validation
- Tests moteur prévus : succès transactionnel, une seule révision, non-mutation de l'état initial, mana insuffisant, source déjà engagée, mauvais contrôleur, coûts mal formés/non supportés et payload incohérent.
- CI verte : run 44096082742 sur `acddf1356b50c90116121cc322ed277d25908019` ; typecheck, Vitest et python-data réussis.


## 2026-11-17 — Première capacité activée serveur/protocole

### Analyse des règles et de l'architecture
- Le PDF Comprehensive Rules fourni décrit l'activation en CR 602.2 : annoncer l'activation crée d'abord un objet non-carte au sommet de la pile, puis les étapes de coûts applicables de CR 601.2b–i sont exécutées. Les annonces et paiements ne sont pas révisables.
- CR 602.5a interdit le coût {T}/{Q} d'une capacité de créature si elle n'a pas été contrôlée depuis le début du tour le plus récent, sauf célérité. Le RuntimeCardState actuel ne conserve ni date d'entrée/contrôle ni célérité calculée : il serait incorrect de supposer cette condition satisfaite.
- CR 605.1a/605.3b distingue les capacités de mana : elles n'utilisent pas la pile et se résolvent immédiatement. Le chemin `tap-for-mana` existant doit rester distinct.
- Le protocole réseau est autoritaire côté serveur et possède déjà révision attendue, idempotence et validation de siège. Le client ne doit donc jamais fournir le coût ni l'effet d'une capacité.

### Décision et implémentation
- Nouvelle commande `activate-ability` avec seulement `instanceId` et `abilityIndex` (index de ligne Oracle, base zéro).
- Le serveur résout la définition par son propre catalogue Scryfall et compile uniquement les lignes exactes sans cible `[coût]: Draw a card.` et `[coût]: You gain N life.`.
- Coûts acceptés : symboles génériques numériques et WUBRGC, séparés par virgules, plus un unique `{T}`. Le moteur existant réalise paiement + engagement + empilement en une transaction atomique.
- Le registre typé prend maintenant en charge les deux payloads activés. Le handler n'effectue que l'effet ; le coordinateur conserve le retrait de pile, les SBA et la priorité.
- Les sources acceptées dans cette tranche sont Artifact, Enchantment, Land et Creature. Les capacités de créatures avec coût {T} sont explicitement refusées tant que l'état ne peut pas vérifier CR 602.5a ; les capacités de créatures sans {T} restent possibles. Les capacités de mana ne sont pas compilées dans ce chemin.

### Limites
- Aucun choix de mode, cible, coût de sacrifice/défausse/PV, coût hybride/phyrexian/X, restriction d'activation ou texte conditionnel.
- Aucun parsing Oracle générique : l'index cible une ligne exacte du champ oracle_text Scryfall.
- Les capacités de planeswalker/loyauté et de créature à coût {T} attendent les états de contrôle depuis le début du tour, célérité et règles de loyauté.

### Tests
- Intégration artifact : commande client minimale, serveur compile le gain de vie, coût générique payé, source engagée, objet typé sur pile, résolution par le handler et rejeu du journal.
- Refus d'un effet inconnu et d'une capacité de créature avec coût {T}, sans mutation ni paiement.

- CI verte : run 44098476723 sur `38c1340e440de82267bec715286539b17d5b99a6` ; typecheck, Vitest et python-data réussis.
