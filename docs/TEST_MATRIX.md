

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
