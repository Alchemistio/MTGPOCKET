

## Activation de capacités sur pile — ajout 2026-11-17
- `packages/game-engine/test/activated-abilities.test.ts` : paiement mana coloré + générique, engagement de la source, insertion d'un `activated-ability`, une seule révision, non-mutation, mana insuffisant, source engagée, mauvais contrôleur, coût mal formé/hybride et cohérence source/contrôleur du StackItem.
- Contrat moteur uniquement : aucune commande GameRoom ni compilation Oracle n'est ajoutée faute de définition structurée de capacité.
- Coûts non couverts : sacrifice, défausse, PV, coûts alternatifs/additionnels, restrictions/timing propres à la capacité, mal d'invocation et capacités de loyauté. Les capacités de mana conservent leur chemin immédiat `tap-for-mana`.
- CI verte : run 44096082742 sur `acddf1356b50c90116121cc322ed277d25908019` ; typecheck, Vitest et python-data réussis.


## Capacités activées — première tranche serveur (2026-11-17)
- Commande `activate-ability` : payload `{ instanceId, abilityIndex }` seulement ; coût/effet sont compilés par le serveur depuis Scryfall.
- Lignes prises en charge : `[coût]: Draw a card.` et `[coût]: You gain N life.`; coût composé uniquement de symboles mana génériques numériques/WUBRGC et au plus un `{T}`.
- Test d'intégration : paiement générique, engagement, empilement, handler typé, résolution sans résolveur legacy et rejeu ; refus d'effet inconnu et de source créature avec coût `{T}`.
- Capacités de mana restent immédiates via `tap-for-mana`. Aucune capacité à cible, coût sacrifice/défausse/PV, restrictions, coût hybride/phyrexian/X ou capacités de loyauté n'est couverte.

- CI verte : run 44098476723 sur `38c1340e440de82267bec715286539b17d5b99a6` ; typecheck, Vitest et python-data réussis.


## ETB — reprise des choix de remplacement (2026-11-18)
- `resumeZoneChangeWithReplacements` reprend une session existante sans reconstruire la proposition ; les choix successifs conservent les effets déjà appliqués et la trace.
- Test moteur : deux points de choix successifs (catégorie copy puis general), état inchangé avant commit, destination et marqueurs validés dans l'événement final.
- Les sessions restent gardées par `state.revision` ; le protocole GameRoom, la persistance et l'authentification des décisions restent non implémentés.


## ETB — suspension serveur des choix de remplacement (2026-11-18)
- `GameRoom` : un sort permanent est suspendu si le pipeline retourne `choice-required` ; la carte source reste en zone stack et l'objet reste en attente de résolution.
- `resolve-zone-change-replacement` : validation du joueur décideur, du pending ID et du candidat ; un choix successif garde la même session et met à jour sa révision.
- Confidentialité : `toPlayerView` n'expose le pending ID et les candidats qu'au contrôleur du permanent entrant.
- Rejeu/restauration : le checkpoint sérialise `pendingZoneChangeChoice` et le journal rejoue les commandes acceptées ; le même `EntryReplacementResolver` doit être fourni à `GameRoom.restore`/`RoomRegistry`.
- Test d'intégration `apps/server/test/game-room.test.ts` : deux décisions successives, rejet d'un autre siège, source et stack item conservés pendant la suspension, commit final, snapshot d'entrée et restauration/rejeu.
- Limites : un événement/permanent et un décideur ; APNAP simultané, événements imbriqués 616.1g et registre complet des remplacements globaux non couverts.
- CI verte : run 44252301628 sur `881592facfb69504ac1f6290a672fe78d28a95b9` pour la suspension serveur, puis run 44252738631 sur `68fb73ca63fa0a2588facb408d46f458bfcef738` après l'ajout du cas CR 608.3e ; typecheck, Vitest et python-data réussis.

- Cas CR 608.3e : si l'événement d'entrée du permanent est prévenu, le sort permanent rejoint le cimetière de son propriétaire via un événement de zone distinct ; il ne reste pas en zone stack. Test `puts a permanent spell into its owner's graveyard when battlefield entry is prevented`.


## ETB-1 — scanner de candidats (2026-11-18)
- `scanBasicZoneChangeTriggers` examine tous les permanents présents sur le battlefield, y compris l'entrant, pour un événement d'entrée commis (base CR 603.6a).
- Motifs stricts : `When {name} enters ... draw a card`, `Whenever [another] creature/permanent enters ... draw a card`, et variantes `you gain N life`.
- Les candidats conservent source, contrôleur au moment du trigger, ID d'événement et index de ligne ; les IDs de StackItem sont déterministes.
- Test `scans every battlefield permanent for matching entry triggers and captures source controllers` : trigger global contrôlé par p2, trigger permanent contrôlé par p3, trigger self de l'entrant p1.
- Scanner de découverte seulement : pas encore de placement sur pile, APNAP, choix d'ordre, batch multi-entrants ni recalcul couche 603.6b ; le chemin live self-ETB historique reste actif en attendant l'intégration au checkpoint.


## ETB-2 — batch APNAP et ordre par contrôleur (2026-11-18)
- `packages/game-engine/src/trigger-ordering.ts` : batch sérialisable, groupes dans l'ordre APNAP calculé depuis le joueur actif, auto-ordre des groupes à un seul trigger et capture des StackItems candidats.
- Chaque contrôleur ordonne uniquement son groupe, dans l'ordre APNAP ; la validation exige une permutation exacte sans doublon ni omission.
- L'API expose l'ordre d'insertion sur la pile (bottom-to-top) une fois tous les groupes ordonnés ; le dernier élément est le sommet et résout en premier.
- Tests : APNAP à quatre sièges avec joueur actif non-p1, plusieurs triggers par contrôleur, contrôleur hors tour, permutation invalide, contrôleur inconnu/éliminé, batch vide et conservation du snapshot candidat.
- Limite : contrat pur et sérialisable uniquement. Pas encore de champ dans GameState, de commande réseau, de placement effectif sur la pile, de checkpoint de priorité ni de boucle SBA/trigger.


## ETB-2 — état serveur, décision APNAP et projection privée (2026-11-18)
- `GameState.pendingTriggerBatch` conserve le batch APNAP ; les anciennes sauvegardes migrent vers `null`.
- Commande `order-etb-triggers` : authentification par contrôleur APNAP courant, ID de batch et permutation exacte des IDs candidats ; chaque décision incrémente la révision et est journalisée.
- `GameView` n'expose les IDs candidats qu'au contrôleur actuellement autorisé ; les autres sièges ne reçoivent que le nombre de groupes encore en attente.
- Tests GameRoom : mauvais contrôleur, mauvais batch, permutation dupliquée/étrangère, séquence APNAP, groupe singleton auto-ordonné, vue privée, snapshot/checkpoint, rejeu et restauration.
- Le batch bloque `pass-priority` afin qu'une décision d'ordre ne puisse pas être contournée.
- Limite : aucun branchement du scanner ETB, aucun placement effectif sur la pile ; même après le dernier ordre, le batch reste présent et bloque la progression jusqu'à la prochaine tranche de finalisation/checkpoint.
