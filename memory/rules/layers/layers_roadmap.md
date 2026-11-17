# Roadmap — moteur de couches

## L0 — Orchestrateur générique
- [x] Contrat d'effet normalisé et typé (id, couche, source, timestamp, payload).
- [x] Plugins de couche et pipeline 1–7.
- [x] Sortie explicite des effets sans plugin.
- [x] Validation des IDs, sources, timestamps et plugins dupliqués.
- [x] Tests de non-mutation et d'erreurs.
- [ ] Adaptateur de la tranche couche 4 existante vers le plugin commun.

## L1 — Ordonnancement normatif (CR 613.7–613.8)
- [x] Contrat d'effets appartenant à une même couche/sous-couche.
- [x] Ordonnanceur dynamique à prédicat de dépendance injecté.
- [x] Réévaluation après chaque effet (613.8c).
- [x] Filtre de compatibilité CDA/CDA ou non-CDA/non-CDA (613.8a).
- [x] Détection des SCC cycliques terminaux et fallback timestamp (613.8b).
- [x] Tests : dépendance opposée au timestamp, dépendance apparaissant après application, boucle avec effet en aval, CDA, erreurs et immutabilité.
- [ ] Implémenter les prédicats de dépendance sémantiques par famille d'effets ; aucun détecteur Oracle générique n'est fourni.
- [ ] Définir et tester la construction des timestamps 613.7a–n (effets statiques, résolution, compteurs, entrées, attachements, APNAP).

## L2 — Caractéristiques et recalcul
- [ ] Implémenter les couches/sous-couches 1a/1b, 2, 3, 4, 5, 6, 7a/7b/7c/7d.
- [ ] Séparer valeurs copiables, caractéristiques imprimées, valeurs définies et effets continus.
- [ ] Recalcul global, effets qui affectent d'autres objets, boucles et stabilisation.
- [ ] P/T, couleurs, capacités, types, sous-types, identité de couleur et coûts.

## L3 — Entrée et intégration
- [ ] Intégration complète au contexte 614.12, y compris l'objet tel qu'il existerait sur le champ de bataille.
- [ ] Intégration aux mouvements de zone, triggers, SBA et snapshots.
- [ ] Corpus de régression de cartes et tests différentiels documentés.
- [ ] Profilage et budget de recalcul pour mobile.
