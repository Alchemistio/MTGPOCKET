# Roadmap et critères de sortie

Les cases ne passent à [x] qu'après implémentation et tests correspondants. CI verte, validation sur simulateur et validation sur appareils physiques sont des états distincts.

## M0 — Fondation — socle présent
- [x] Monorepo pnpm, TypeScript strict, CI.
- [x] Architecture, spécification produit, UX et périmètre de règles.
- [x] Modèle de table à quatre joueurs, zones, instances runtime et priorité.
- [x] Index documentaire, fiches de référence, ADR et journal.
**Sortie :** installation, typecheck et tests CI reproductibles.

## M0.5 — Stabilisation et critères de merge de la PR #1
Cette étape clôture la fondation avant intégration dans `main`. La PR reste en brouillon jusqu'à validation de ces critères.

- [x] CI initiale verte sur le code précédent : run `43689458355`, SHA `7d6b320` (typecheck, Vitest, Python).
- [x] Parcours automatisé à quatre sièges : soumission des decks, mulligan, démarrage, vues privées et première commande via WebSocket.
- [ ] Vérifier la CI sur les nouveaux commits de persistance et de restauration.
- [ ] Valider la sauvegarde atomique, la restauration après redémarrage, le rejeu et l'idempotence sur un serveur relancé.
- [ ] Valider la reconnexion/réauthentification du client mobile avec les jetons de siège après redémarrage.
- [ ] Tester au minimum deux appareils physiques sur un même Wi-Fi ; viser quatre appareils pour la validation LAN complète.
- [ ] Relecture finale du diff, des limites connues, des permissions de stockage et des données privées.
**Gate de merge :** CI verte sur le dernier code, récupération d'une partie active vérifiée, absence de défaut bloquant connu, et test physique minimal à deux appareils. La couverture complète des Comprehensive Rules et de toutes les cartes n'est pas un prérequis au merge ; elle reste un chantier incrémental de M2.

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
- [x] État de déconnexion visible dans le panneau pré-partie; délais bornés sur l'ouverture WebSocket et les handshakes de salle.
- [x] Timeout des actions pré-partie individuelles avec verrouillage des nouvelles commandes jusqu'à reconnexion.
- [ ] Reprise/réauthentification automatique après reconnexion, y compris après redémarrage du serveur à partir des jetons de siège persistés sous forme de hash.
- [x] Résolution serveur d’un objet de pile après passes unanimes, via un handler d’effet injecté et rejouable.
- [x] Infrastructure de lancement d’instants/rituels simples depuis la main : coût générique/couleur, pile, réponse d’un autre joueur, résolution LIFO via handler serveur et envoi au cimetière.
- [ ] Étendre le lancement aux permanents, cibles, coûts alternatifs et handlers d’effets réels.
- [x] Cleanup serveur : défausse de fin de tour contrôlée par le siège concerné, puis progression automatique vers l'upkeep du joueur suivant.
- [x] Test serveur d'un tour de p1 depuis main 1 jusqu'à l'upkeep p2 : instant, réponse adverse, résolution LIFO, passes des étapes de combat, cleanup et défausse.
- [x] Raccorder à l'UI mobile la main privée, les sorts serveur supportés et la défausse de cleanup.
- [ ] Tester une partie complète sur appareils physiques.
- [x] Journal mémoire des commandes acceptées et rejeu déterministe depuis le snapshot autoritaire du démarrage (versions moteur/protocole inscrites).
- [x] Capture serveur en mémoire des graines d'ouverture et de mulligan, hors vues client.
- [ ] Finaliser la validation de la persistance durable du snapshot autoritaire, du journal accepté et du seed log : stockage JSON atomique et restauration/rejeu implémentés ; test de processus serveur réel encore requis.
- [ ] Persister aussi l'état intermédiaire de pré-partie (decks soumis, décisions de mulligan, choix bottom et graines déjà générées) pour reprendre une pré-partie interrompue ; à ce stade, les seeds sont écrits au démarrage de la partie.
- [ ] Vérifier l'atomicité de bout en bout : aucun ACK de commande acceptée avant écriture durable ; rollback de l'état mémoire si l'écriture échoue.

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
- [x] Projection privée de la main avec nom/coût/type et UI compacte pour lancer les sorts supportés, sélectionner la défausse de cleanup et engager les terrains de base pour du mana.
- [ ] Main réelle complète, piles compactées, badges et attachements.
- [x] Tiroir de pile compact avec contrôleur, carte/coût, ordre LIFO et toggle auto-yield conditionnel.
- [ ] Réponses rapides complètes, auto-yield avec toutes les capacités activées.
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
