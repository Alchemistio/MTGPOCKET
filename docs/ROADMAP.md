# Roadmap et critères de sortie

## M0 — Fondation
- [x] Dépôt et branche de travail identifiés.
- [x] Architecture, produit, règles et UX documentés.
- [ ] Workspace compilable et CI.
- [ ] Modèle de partie, priorité et premiers tests.
**Sortie :** installation reproductible, typecheck/tests automatisés, moteur de tour testable.

## M1 — Partie locale jouable
4 sièges, zones, deck/mulligan, mélange seedé, tours/phases/étapes, priorité, pile, prompts, vie, taxe et dégâts de commandant, journal et reprise.
**Sortie :** scénario complet avec cartes de test, même si les effets de cartes restent limités.

## M2 — Fidélité du moteur
Actions basées sur un état, capacités statiques/activées/déclenchées, couches, remplacement/prévention, combat multijoueur, coûts, cibles, copies, choix et matrice de couverture.
**Sortie :** interactions prioritaires testées et limites documentées.

## M3 — Mobile
Navigation, lobby, deckbuilding, recherche, plateau paysage 4 joueurs, radar/gaze, main, tiroir de pile, piles, badges, attachements et accessibilité.
**Sortie :** prototype mobile jouable en local sur petits écrans.

## M4 — Réseau local
Salons, invitations, WebSocket, serveur autoritaire, reprise, vues privées et tests de latence/déconnexion.
**Sortie :** quatre appareils dans une partie fiable.

## M5 — Données
Adaptateur Scryfall, cache, import MTGJSON, multi-faces/layouts, validation de decks Commander.
**Sortie :** decks réels validés et cartes consultables hors-ligne après cache.

## M6 — Solo et bêta
IA progressive, tutoriels, historique, statistiques, optimisation et publication bêta.

## Definition of Done
Code typé, tests pertinents exécutés, règles non supportées explicites, erreurs documentées, UX vérifiée sur appareils et paramètres d'accessibilité.
