# ETB — index du module

## Périmètre
Capacités déclenchées par l'arrivée d'un permanent sur le champ de bataille et règles adjacentes qui modifient l'événement d'arrivée ou le traitement des déclenchements.

## Documents
- [Recherche normative et technique](etb_research.md)
- [Roadmap complète](etb_roadmap.md)

## Règles principales
- 603.6 / 603.6a–e — zone-change triggers et ETB.
- 603.2 / 603.2c–h — occurrence réelle, répétition et événements remplacés/prévenus.
- 603.3 / 603.3a–d — mise sur la pile, contrôleur, APNAP, modes et choix.
- 603.4–603.5 — intervening-if et capacités optionnelles.
- 603.7 / 603.12 — capacités retardées et réflexives.
- 603.10–603.11 — last known information, exceptions et capacités liées.
- 113.6 / 113.6h–k — zones où les capacités fonctionnent et capacités qui modifient l'entrée.
- 400.7 — identité d'objet lors des changements de zone.
- 614.12 / 616.1 — remplacement de la manière dont un permanent entre et interaction des remplacements.
- 613 — couches et caractéristiques continues.
- 101.4, 117, 405 — APNAP, priorité et pile.

## État du code
Le serveur prend actuellement en charge deux motifs auto-référentiels restreints (piocher une carte, gagner N points de vie), codés dans `apps/server/src/basic-spell-effects.ts`. Ce n'est pas un moteur ETB générique ; cette tranche doit migrer vers le compilateur Oracle et le dispatcher générique.
