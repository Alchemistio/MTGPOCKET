

## Activation de capacités sur pile — ajout 2026-11-17
- `packages/game-engine/test/activated-abilities.test.ts` : paiement mana coloré + générique, engagement de la source, insertion d'un `activated-ability`, une seule révision, non-mutation, mana insuffisant, source engagée, mauvais contrôleur, coût mal formé/hybride et cohérence source/contrôleur du StackItem.
- Contrat moteur uniquement : aucune commande GameRoom ni compilation Oracle n'est ajoutée faute de définition structurée de capacité.
- Coûts non couverts : sacrifice, défausse, PV, coûts alternatifs/additionnels, restrictions/timing propres à la capacité, mal d'invocation et capacités de loyauté. Les capacités de mana conservent leur chemin immédiat `tap-for-mana`.
- CI verte : run 44096082742 sur `acddf1356b50c90116121cc322ed277d25908019` ; typecheck, Vitest et python-data réussis.
