# Roadmap et critères de sortie

## M0 — Fondation <badge>validé</badge>
- [x] Dépôt, branche de travail et PR dédiés.
- [x] Monorepo pnpm, TypeScript strict et pipeline CI.
- [x] Architecture, produit, règles et UX documentés.
- [x] Modèle à quatre joueurs, zones, instances runtime et priorité.
- [x] Tests automatisés moteur, données et serveur.
**Sortie :** installation reproductible, typecheck et tests verts sur GitHub Actions.

## M1 — Partie locale jouable <badge>en cours</badge>
- [x] Setup Commander : commandants en zone de commandement, 40 PV, mélange et main de sept cartes.
- [x] Mulligan de Londres multijoueur, premier mulligan gratuit et sélection des cartes à remettre sous la bibliothèque après chaque mulligan.
- [x] Phases/étapes, passes de priorité, pile générique et handlers d'effets injectés.
- [x] Pioche, dégagement, vidage du mana entre étapes, nettoyage des blessures et défausse de fin de tour.
- [x] Vie, pioche impossible, 21 blessures de commandant, taxe et élimination multijoueur.
- [x] Validation initiale de decks Commander (taille, singleton, identité couleur, légalité, éligibilité/partenariat par registre).
- [ ] Connecter un deck réel au serveur et à l'app, puis jouer un tour complet avec une carte de test.
- [ ] Persister les événements et reprendre une partie après reconnexion.
**Sortie :** scénario complet avec cartes de test et historique rejouable.

## M2 — Fidélité du moteur
- [ ] Actions basées sur un état complètes (créatures, auras, légende, jetons, planeswalkers, etc.).
- [ ] Capacités statiques, activées et déclenchées.
- [ ] Couches, coûts, cibles, copies, remplacement et prévention.
- [ ] Combat multijoueur complet et dégâts assignés/résolus.
- [ ] Règles de commandant restantes, notamment retours/remplacements vers la zone de commandement.
**Sortie :** interactions prioritaires testées et matrice de couverture détaillée.

## M3 — Mobile <badge>prototype</badge>
- [x] Plateau paysage quatre joueurs et télémétrie compacte.
- [x] Prototype interactif connecté au moteur pour les passes de priorité.\n- [x] Recherche Scryfall, détail multi-faces et cache SQLite local accessibles depuis le plateau.
- [ ] Lobby, recherche de cartes, deckbuilding et collection.
- [ ] Main réelle, piles compactées, badges, attachements et tiroir de pile interactif.
- [ ] Radar/gaze gesture, gestes accessibles et motifs géométriques WUBRG.
**Sortie :** prototype jouable sur appareils 5,5–6,7 pouces.

## M4 — Réseau local <badge>socle</badge>
- [x] Serveur et client WebSocket LAN, écrans créer/rejoindre, jetons de siège et vues privées.
- [x] Révisions, idempotence et vues filtrées par joueur.
- [ ] Commandes de jeu complètes, découverte LAN, reconnexion, reprise et tests de déconnexion.
- [ ] Authentification et sécurité adaptées à un réseau non fiable.
**Sortie :** quatre appareils dans une partie fiable.

## M5 — Données <badge>socle</badge>
- [x] Client Scryfall typé, cartes multi-faces et cadence des requêtes.
- [x] Validation initiale des decks Commander.
- [x] Store SQLite mobile persistant, TTL et composition du repository Scryfall.\n- [ ] Brancher la recherche avancée dans l’UI et compléter le mode hors ligne (index local/import bulk).
- [ ] Import MTGJSON et adaptateurs secondaires vérifiés.
**Sortie :** decks réels validés et cartes consultables hors ligne après cache.

## M6 — Solo et bêta
- [ ] IA progressive, tutoriels, historique, statistiques et outils de débogage.
- [ ] Profilage, optimisation, tests appareils et publication bêta.

## Definition of Done
Code typé, tests pertinents exécutés, règles non supportées explicites, erreurs documentées, UX vérifiée sur appareils et paramètres d'accessibilité.
