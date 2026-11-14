# Roadmap et critères de sortie

Les cases ne passent à [x] qu'après implémentation et tests correspondants. CI verte, validation sur simulateur et validation sur appareils physiques sont des états distincts.

## M0 — Fondation — socle présent
- [x] Monorepo pnpm, TypeScript strict, CI.
- [x] Architecture, spécification produit, UX et périmètre de règles.
- [x] Modèle de table à quatre joueurs, zones, instances runtime et priorité.
- [x] Index documentaire, fiches de référence, ADR et journal.
**Sortie :** installation, typecheck et tests CI reproductibles.

## M1 — Partie locale jouable — en cours ([issue #2](https://github.com/Alchemistio/MTGPOCKET/issues/2))
- [x] Setup Commander : commandants en zone de commandement, 40 PV, mélange et main initiale.
- [x] Mulligan de Londres multijoueur, premier mulligan gratuit et sélection des cartes à remettre.
- [x] Phases/étapes, passes de priorité, pile générique et handlers injectés.
- [x] Pioche, dégagement, vidage du mana, nettoyage des blessures et taille de main.
- [x] Pertes sur vie, pioche impossible, 21 blessures de commandant, taxe et élimination.
- [x] Validation initiale de decks.
- [x] Service serveur de pré-partie : validation des quatre listes, création des instances, commandants, mains initiales et mulligans (tests unitaires).
- [x] Transport WebSocket serveur pour soumission de deck, mulligan, cartes à remettre et démarrage ; réponses de pré-partie projetées au siège authentifié.
- [x] Transfert de l'état pré-partie validé vers le GameRoom autoritaire et ouverture de la première priorité (upkeep).
- [x] Test d'intégration WebSocket automatisé à quatre sièges : decks, keep, démarrage, mains privées et première passe de priorité.
- [x] Intégration des opérations deck/mulligan/bottom/start dans le modal mobile, avec progression et retours de refus serveur.
- [ ] Gestion des erreurs réseau, timeouts, déconnexions et reprise de l'interface pré-partie.
- [x] Résolution serveur d’un objet de pile après passes unanimes, via un handler d’effet injecté et rejouable.
- [ ] Jouer un tour complet, avec au moins un sort, une réponse, une résolution et un cleanup.
- [x] Journal mémoire des commandes acceptées et rejeu déterministe depuis le snapshot autoritaire du démarrage (versions moteur/protocole inscrites).
- [ ] Persistance durable, conservation des graines de pré-partie et rejeu après redémarrage.
**Sortie :** scénario bout en bout avec cartes de test, historique rejouable et aucune mutation d'état client autoritaire.

## M2 — Fidélité du moteur ([issue #3](https://github.com/Alchemistio/MTGPOCKET/issues/3))
- [ ] SBA générales complètes et vérifiées aux checkpoints.
- [ ] Retour/remplacement du commandant (CR 704.6d, 903.9).
- [ ] Capacités statiques, activées et déclenchées.
- [ ] Coûts, cibles, couches, copies, remplacement et prévention.
- [ ] Combat multijoueur complet et dégâts assignés/résolus.
- [ ] Matrice de couverture et corpus de tests de régression.
**Sortie :** couverture des règles communes et des cartes supportées explicitement déclarée.

## M3 — Mobile — prototype ([issue #6](https://github.com/Alchemistio/MTGPOCKET/issues/6))
- [x] Plateau paysage quatre joueurs et télémétrie compacte.
- [x] Recherche Scryfall, détail multi-face et cache SQLite.
- [ ] Deckbuilder, collection et sélection de commandant.
- [ ] Main réelle, piles compactées, badges et attachements.
- [ ] Tiroir de pile interactif, réponses rapides, auto-yield.
- [ ] Radar/gaze gesture et motifs géométriques WUBRG.
- [ ] Tests VoiceOver/TalkBack, tailles de texte et appareils 5,5–6,7 pouces.
**Sortie :** flux complet de partie jouable et utilisable sur iOS/Android.

## M4 — Réseau local — socle ([issue #4](https://github.com/Alchemistio/MTGPOCKET/issues/4))
- [x] Serveur/client WebSocket, créer/rejoindre, jetons et vues privées.
- [x] Validation serveur des quatre sièges (identifiants uniques, sièges 0–3 sans doublon) avant l'enregistrement de la salle.
- [x] Décision de retour du commandant acheminée au propriétaire et résolue côté serveur.
- [x] Révisions et idempotence de commandes.
- [ ] Commandes de jeu complètes, validation serveur et synchronisation de toutes les zones.
- [ ] Découverte LAN, reconnexion, reprise de partie et gestion des conflits.
- [ ] Sécurité : jetons à usage/rotation, TLS selon réseau, limitation de débit, anti-rejeu.
- [ ] Tests quatre appareils, perte Wi-Fi, hôte quittant, paquets invalides.
**Sortie :** quatre appareils peuvent terminer une partie sans divergence.

## M5 — Données et offline ([issue #5](https://github.com/Alchemistio/MTGPOCKET/issues/5))
- [x] Client Scryfall typé et cache.
- [x] Store SQLite mobile.
- [x] Importateur MTGJSON streaming et checksum.
- [ ] Index local complet, sync incrémentale et migrations.
- [ ] Recherche avancée et fonctionnement hors ligne.
- [ ] Tests de tous les layouts multi-faces et schémas nouveaux.
**Sortie :** deck validé et cartes disponibles hors ligne sans dépendance à un appel réseau par carte.

## M6 — Solo et bêta ([issue #7](https://github.com/Alchemistio/MTGPOCKET/issues/7))
- [ ] IA progressive et adversaires de test.
- [ ] Tutoriels, historique, statistiques et outils de débogage.
- [ ] Profilage, tests appareils, crash reporting et bêta privée.
**Sortie :** release candidate iOS/Android avec checklist de publication.

## Definition of Done
Typecheck et tests pertinents verts ; cas négatifs et régressions ; erreurs et règles non supportées explicites ; documentation/index/journal à jour ; tests natifs et UX validés sur appareils pour toute fonctionnalité mobile.
