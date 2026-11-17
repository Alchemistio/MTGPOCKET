# Roadmap — moteur de pile

## S0 — Cycle de vie générique
- [x] Contrat commun sort/capacité activée/capacité déclenchée/copie via StackItem.
- [x] Validation de l'ajout, identifiant, contrôleur et zone du sort.
- [x] Ajout, lecture du sommet, verrou de résolution et retrait.
- [x] Handler de résolution injecté, séparé du cycle de vie.
- [x] Tests nominal, doublon, mauvais sommet et transition.
- [ ] Migrer entièrement les fonctions de GameState existantes vers ce module sans casser l'API.
- [x] Migrer les deux ETB basiques supportés (pioche, gain de vie) vers le registre serveur typé.
- [x] Migrer les sorts instantanés/rituels de pioche simple et gain de vie vers le registre typé.
- [x] Contrat transactionnel moteur pour activer une capacité sur pile (mana générique/coloré + engagement optionnel).
- [ ] Migrer une famille de capacités activées réelles depuis une définition de carte et le protocole serveur.
- [x] Frontière de handlers typés : registre par catégorie, décodage runtime, refus explicite et tests sans mutation en cas d'échec.

## S1 — Coordinateur de règles
- [ ] Priorité multijoueur et passes APNAP robustes.
- [ ] Fenêtres de priorité et déclenchements simultanés.
- [ ] Choix/modes/cibles avec validation et légalité au moment requis.
- [ ] Paiement complet des coûts d'activation : sacrifice, défausse, PV, coûts alternatifs/additionnels et ordre d'annonce/paiement.
- [ ] Validation des restrictions/timing propres à chaque capacité, mal d'invocation et capacités de loyauté.
- [ ] Capacités qui ne passent pas par la pile et actions spéciales ; conserver une voie dédiée pour les capacités de mana.

## S2 — Résolution et événements
- [ ] Résolution partielle/contre, cibles illégales, fizzle et règles de résolution.
- [ ] Effets composables, événements enfants et SBA entre les étapes requises.
- [ ] Copies, objets indépendants de leur source, changements de contrôleur.
- [ ] Triggers pendant/après résolution et placement APNAP.

## S3 — Durabilité et UX
- [ ] Journal d'événements et rejeu déterministe de chaque transition.
- [ ] Reprise d'un choix en attente et validation de révision.
- [ ] Contrat de projection UI : ordre LIFO, source, contrôleur, cibles et statut.
- [ ] Macros de résolution/auto-yield sûres, sans court-circuiter les fenêtres de priorité.
