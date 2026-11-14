# Journal de suivi du projet

## 2026-11-14 — Correction du test d'isolation des salles

- Analyse du run CI 43570125930 : typecheck réussi, tests serveur en échec sur une assertion du test PregameSessionRegistry.
- Le test réutilisait par erreur un jeton valide de la salle g1 pour un scénario supposé non authentifié ; le contrôle d'accès fonctionnait correctement.
- Correction : le scénario inter-salles utilise maintenant le jeton p2 émis pour g2 et vérifie le rejet sur g1 ; le jeton p2 de g1 reste accepté.
- La soumission de deck capture désormais aussi les erreurs levées pendant l'authentification/création de session, avec le même format d'erreur que les autres opérations.
- Nouveau run CI à confirmer sur ce commit.
- Limite inchangée : le registre de pré-partie n'est pas encore raccordé au gestionnaire WebSocket/mobile ; le catalogue et la politique de légalité sont injectés côté serveur.

## 2026-11-14 — Adaptateur authentifié du pré-game

- Ajout de PregameSessionRegistry, qui relie le coordinateur de pré-partie aux jetons de siège émis par RoomRegistry.
- Les opérations soumission de deck, déclaration de mulligan, choix des cartes à remettre et démarrage exigent un jeton valide.
- Chaque résultat renvoie une vue projetée pour le joueur appelant ; les identités des mains adverses restent masquées.
- La création du coordinateur est injectée via une factory : le catalogue de cartes et la politique Commander restent exclusivement fournis par le serveur.
- Tests ajoutés pour les jetons invalides, l'isolation des mains et le refus de démarrage avant que la pré-partie soit prête.
- CI : à vérifier sur le commit courant.
- Limite : cet adaptateur de service est testé, mais les messages WebSocket et l'application mobile ne l'appellent pas encore.
- Prochaine étape : intégrer cet adaptateur au gestionnaire WebSocket avec validation stricte des payloads, réponses par siège et tests d'intégration de transport.

## 2026-11-14 — Validation atomique de la configuration des salles

- RoomRegistry.create valide le gameId, les quatre joueurs, l'unicité des identifiants, les noms non vides et les sièges exacts 0 à 3 avant de construire ou d'enregistrer une salle.
- Les configurations invalides échouent avec des codes explicites et ne laissent aucune entrée partielle dans le registre.
- Tests ajoutés pour les identifiants dupliqués, sièges dupliqués/hors plage, identifiant de salle vide et nombre de joueurs incorrect.
- Nettoyage d'un marqueur de saut de ligne affiché littéralement dans la roadmap.
- Tests/CI : run 43569526212 déclenché sur le commit de validation ; résultat à consulter.
- Limite : la pré-partie reste un service non branché au WebSocket/mobile ; la distribution actuelle des jetons reste réservée à un réseau local de confiance.
- Prochaine étape : exposer les commandes de pré-partie via un flux authentifié et isoler les réponses contenant des informations privées.

## 2026-11-13 — Coordinateur de pré-partie autoritaire

- Ajout du PregameCoordinator côté serveur : réception d'une liste de deck par siège, validation à partir du catalogue et de la politique de légalité fournis par le serveur, expansion en instances runtime, placement des commandants, mélange et distribution des mains initiales.
- Coordination des déclarations de mulligan simultanées, génération des graines côté serveur, choix privés des cartes à remettre sous la bibliothèque et démarrage uniquement lorsque les quatre joueurs ont gardé.
- Les vues existantes masquent toujours l'identité des mains adverses ; tests de non-régression ajoutés pour la confidentialité et les refus de decks invalides.
- CI GitHub Actions 43475390536, commit 15ce2127251c62f46897ba85994f1436b7dbc7f7 : validate (typecheck + Vitest) et python-data réussis.
- Limite actuelle : le coordinateur est un service serveur testable, mais il n'est pas encore raccordé aux messages WebSocket/mobile. La politique d'éligibilité Commander reste une dépendance versionnée injectée par le serveur ; aucune légalité client n'est acceptée.
- Prochaine étape : exposer ces opérations via un protocole de pré-partie authentifié, avec réponses ciblées au joueur et tests d'intégration WebSocket.

Journal append-only : ajouter une nouvelle entrée en tête, ne pas réécrire l'historique.
