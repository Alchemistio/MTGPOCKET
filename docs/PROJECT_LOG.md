

## 2026-11-17 — Contrat atomique d'activation des capacités
- Ajout de `activateStackAbility` au moteur partagé pour les capacités activées qui utilisent la pile : validation de la source et du contrôleur, paiement du mana générique/coloré simple, engagement optionnel et insertion de l'objet de pile.
- L'ensemble est atomique et incrémente la révision une seule fois ; les échecs ne modifient pas l'état.
- Les capacités de mana existantes (`tap-for-mana`) restent immédiates et sans pile.
- Le serveur ne route pas encore de capacités activées : absence de schéma structuré pour les capacités de carte, coûts avancés, timing et restrictions.
- Tests unitaires ajoutés pour succès, échecs, coûts non supportés et non-mutation. CI à vérifier.
