

## 2026-11-17 — Contrat atomique d'activation des capacités
- Ajout de `activateStackAbility` au moteur partagé pour les capacités activées qui utilisent la pile : validation de la source et du contrôleur, paiement du mana générique/coloré simple, engagement optionnel et insertion de l'objet de pile.
- L'ensemble est atomique et incrémente la révision une seule fois ; les échecs ne modifient pas l'état.
- Les capacités de mana existantes (`tap-for-mana`) restent immédiates et sans pile.
- Le serveur ne route pas encore de capacités activées : absence de schéma structuré pour les capacités de carte, coûts avancés, timing et restrictions.
- Tests unitaires ajoutés pour succès, échecs, coûts non supportés et non-mutation. CI verte : run 44096082742 sur `acddf1356b50c90116121cc322ed277d25908019` ; typecheck, Vitest et python-data réussis.


## 2026-11-17 — Première capacité activée via protocole

- Ajout de `activate-ability` : le client transmet l'instance et l'index de ligne Oracle, jamais le coût ni l'effet.
- Le serveur compile depuis CardDefinition Scryfall deux effets sans cible : pioche d'une carte et gain de vie numérique. Coûts supportés : mana générique/coloré simple et engagement optionnel.
- L'objet rejoint la pile et se résout via le registre typé ; le coordinateur conserve le cycle de vie. La commande acceptée est journalisée et rejouable.
- Les capacités de créature avec {T} sont refusées faute de suivi de contrôle depuis le début du tour/célérité (CR 602.5a). Les capacités de mana restent sur leur chemin immédiat (CR 605.3b).
- CI verte : run 44098476723 sur `38c1340e440de82267bec715286539b17d5b99a6` ; typecheck, Vitest et python-data réussis.


## 2026-11-18 — ETB : reprise des sessions de remplacement dans le moteur
- Ajout de `resumeZoneChangeWithReplacements` pour poursuivre une proposition après un choix de remplacement sans perdre les remplacements déjà appliqués.
- Le point d'entrée initial `processZoneChangeWithReplacements` délègue à la même primitive de reprise ; une nouvelle décision peut être demandée après chaque réévaluation.
- Test moteur ajouté pour deux choix successifs, non-mutation avant commit, trace déterministe et modification d'entrée incluse dans le snapshot final.
- Le protocole serveur et la persistance des choix ne sont pas inclus dans cette tranche ; GameRoom ne doit pas encore exposer ce mécanisme comme une fonctionnalité utilisable en partie.
