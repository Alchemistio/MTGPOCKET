# Roadmap — moteur de couches

## L0 — Orchestrateur générique
- [x] Contrat d'effet normalisé et typé (id, couche, source, timestamp, payload).
- [x] Plugins de couche et pipeline 1–7.
- [x] Sortie explicite des effets sans plugin.
- [x] Validation des IDs, sources, timestamps et plugins dupliqués.
- [x] Tests de non-mutation et d'erreurs.
- [ ] Adaptateur de la tranche couche 4 existante vers le plugin commun.
## L1 — Ordonnancement normatif
- [ ] Représentation des précédences résolues.
- [ ] Détection/résolution des dépendances selon CR 613.7, avec preuves de changement d'applicabilité/effet.
- [ ] Ordre timestamp / ordre des couches / exceptions de règles et cas de dépendance circulaire.
- [ ] Tests de scénarios contradictoires et propriétés de déterminisme.
## L2 — Caractéristiques et recalcul
- [ ] Implémenter les couches 1a/1b, 2, 3, 4, 5, 6, 7a/7b/7c.
- [ ] Séparer valeurs copiable, caractéristiques imprimées, valeurs définies et effets continus.
- [ ] Recalcul global, effets qui affectent d'autres objets, boucles et stabilisation.
- [ ] P/T, couleurs, capacités, types, sous-types, identité de couleur et coûts.
## L3 — Entrée et intégration
- [ ] Intégration complète au contexte 614.12, y compris l'objet tel qu'il existerait sur le champ de bataille.
- [ ] Intégration aux mouvements de zone, triggers, SBA et snapshots.
- [ ] Corpus de régression de cartes et tests différentiels documentés.
- [ ] Profilage et budget de recalcul pour mobile.
