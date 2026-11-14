## 2026-11-14 — Correctifs de validation après revue locale du diff

- Revue du commit initial: contrôle de date stricte non appliqué et helper de test manquant, corrigés dans ce commit.
- CI du commit précédent à ignorer pour validation finale; attendre le run sur le commit correctif.

## 2026-11-14 — Validation stricte de la policy Commander

- Loader: dates ISO calendrier strictes; refuse doublons d'Oracle IDs, conflits banni/éligible, IDs absents du snapshot, paires dupliquées ou non éligibles, clés de nom invalides.
- Tests ajoutés pour dates impossibles, doublons, références inconnues, conflit ban/éligibilité et paire invalide.
- Aucun contenu de banlist/éligibilité inventé; données réelles toujours à curater. CI à vérifier.

## 2026-11-14 — Générateur snapshot Scryfall bulk

- bf7ac8a ajoute scripts/build_scryfall_catalog.py et tests: manifeste Scryfall, bulk default_cards, parsing ijson en streaming, SHA-256, provenance, snapshot écrit atomiquement.
- CI 43619379423 détecte une enveloppe JSON invalide; tests Python échouent sur json.loads.
- 73cca32 corrige l'ouverture du tableau cards; CI 43619439316 verte: typecheck, Vitest et Python.
- Aucun téléchargement réel Scryfall effectué dans cette étape; snapshot non provisionné. Policy Commander reste manuelle et non validée.

## 2026-11-14 — Loader catalogue serveur: correctifs CI

- Commit initial b7fc358: CI détecte deux erreurs de narrowing TypeScript dans le parseur JSON; Python passe.
- b9ec1da corrige les tableaux Oracle ID; CI révèle un narrowing manquant sur oracle_id optionnel.
- b3e3c0a corrige ce dernier contrôle; CI run 43615546352: typecheck, Vitest et python-data réussis.
- Le loader est branché au bootstrap par variables d'environnement; aucun snapshot réel ni policy réelle n'est provisionné. Aucun test appareil ou session 4 clients.

## 2026-11-14 — Loader catalogue serveur et policy Commander

- Ajout d'un loader strict pour snapshots JSON Scryfall versionnés et policy Commander explicite (banlist, commandants éligibles, paires compatibles, exceptions singleton, clés de nom).
- Le bootstrap lit CPOCKET_CARD_CATALOG_PATH et CPOCKET_COMMANDER_POLICY_PATH; config partielle/invalide => échec startup; absence des deux => pré-partie désactivée.
- Les cartes bannies de la policy sont forcées illégales côté Commander. Les données client ne servent jamais à valider les decks.
- Tests ajoutés: snapshot valide, policy absente/non versionnée, carte mal formée, variables d'environnement partielles.
- Aucun snapshot réel ni policy officielle n'est fourni/committé; il faut les provisionner et réviser avant activation. CI à vérifier.

## 2026-11-14 — CI verte après correctif multi-sièges

- Commit `74b9f36b9f1b6b1ed36572e2d1c214e110727bbf`, run `43607608283`: `validate` (typecheck + Vitest) et `python-data` réussis.
- Le run précédent `43607532811` avait échoué sur deux déclarations de variable dans le test; renommage corrigé, sans changement runtime.
- Synchronisation des vues pré-partie validée au niveau typecheck/tests automatisés; appareils réels non testés.

## 2026-11-14 — Correctif CI de la synchronisation pré-partie

- Run `43607532811`: `python-data` passe; `validate` échoue au typecheck uniquement dans le test `pregame-session-registry.test.ts` (variable `aliceView` déclarée deux fois et narrowing sur le mauvais résultat).
- Correctif: renommer la variable de vue privée dans l'assertion multi-sièges; logique serveur/mobile inchangée.
- Nouveau run CI requis.

## 2026-11-14 — Synchronisation pré-partie multi-sièges

- Après chaque action pré-partie acceptée, le serveur diffuse une `pregame-view` dédiée à chaque siège connecté; chaque vue est reconstruite par `toPlayerView` pour conserver les mains adverses masquées.
- `PlayerGameView` expose `hasKeptHand` et `pendingBottomCount` (état de progression public, pas le contenu des mains).
- Le mobile écoute ces vues, actualise le nombre de cartes à remettre et détecte quand tous les joueurs ont gardé.
- Ajout d'un test de registre vérifiant quatre vues distinctes et l'isolation des mains.
- CI du nouveau commit à vérifier. Pas de test appareil.
- Prochaine étape: catalogue serveur + policy Commander versionnée; sans eux le bootstrap reste `PREGAME_NOT_CONFIGURED`.

## 2026-11-14 — Validation de l'intégration mobile

- CI run `43606919803`, commit `b8482ae622ae2540d2d161f373a87c4c1506f4f7`: `validate` (typecheck + Vitest) et `python-data` réussis.
- Limite repérée à traiter avant un vrai test 4 sièges: les résultats pré-partie sont actuellement unicast au joueur actif; les autres clients ne reçoivent pas encore leur nouvelle main/leur compteur de cartes à bottomer quand le round de mulligan se résout.
- Le bootstrap serveur n'injecte toujours pas le catalogue ni la policy, donc la pré-partie reste fermée par défaut (`PREGAME_NOT_CONFIGURED`).

## 2026-11-14 — Constructeur de deck et entrée pré-partie mobile

- Ajout d'un modal réseau pré-partie dans l'app: recherche Scryfall, sélection d'un commandant, liste locale de 100 cartes, retrait d'entrées, puis accès au panneau deck/mulligan/bottom/start.
- Le panneau est désormais atteignable depuis le plateau après connexion LAN; le deck reste local jusqu'à soumission et le serveur garde l'autorité de validation.
- Limites explicites: singleton/identité couleur/éligibilité commandant non pré-validés par le constructeur; le serveur doit appliquer la policy. Le bootstrap serveur actuel n'injecte toujours pas de catalogue/policy, donc les commandes répondent `PREGAME_NOT_CONFIGURED` en l'état.
- Tests appareil non exécutés. CI du commit à vérifier.
- Prochaine étape: injecter un catalogue serveur versionné et une policy Commander, puis tests intégration 4 sièges.

# Journal de suivi du projet

## 2026-11-14 — État de CI de la tranche UI pré-partie

- Run 43598197190: CI verte pour cd26820 (typecheck/tests TypeScript et Python).
- Correctif adafe27 ajouté ensuite pour activer le mulligan après confirmation de soumission individuelle; run 43598243291 encore en file d'attente au dernier contrôle.
- RESUME.md actualisé avec les deux commits et l'état CI courant.


## 2026-11-14 — Autoriser mulligan après soumission individuelle

- Le serveur répond à chaque deck avec allDecksSubmitted=false jusqu'au quatrième joueur; cette valeur ne signifie pas que le deck de l'appelant a été refusé.
- Le panneau marque donc le deck localement soumis dès qu'une réponse de soumission contient le champ allDecksSubmitted, quelle que soit sa valeur.
- Les commandes mulligan peuvent ensuite être envoyées; le serveur reste autoritaire et répond DECKS_NOT_READY tant que les quatre decks ne sont pas reçus.


## 2026-11-14 — UI pré-partie et point de reprise

- Ajout de NetworkPregamePanel: envoi deck, keep/mulligan, sélection du nombre demandé de cartes, start si le serveur confirme readyToStart.
- Les cartes sont identifiées par instance ID; noms Scryfall non reliés dans ce panneau.
- Ajout docs/RESUME.md comme point de reprise compact; README et index y pointent.
- CI à confirmer. Composant réutilisable, pas encore monté dans un écran/navigation.
- Bloqueur: serveur sans catalogue/policy injectés; PREGAME_NOT_CONFIGURED.


## 2026-11-14 — Correction de compatibilité readonly dans le client de pré-partie

- Le run CI 43595261312 a détecté que CommanderDeckList expose des tableaux readonly alors que le contrat réseau utilise des tableaux JSON mutables.
- RoomClient copie maintenant explicitement les identifiants de commandants et les entrées de cartes à la frontière de sérialisation ; les données du deck appelant ne sont pas mutées.
- Le job Python est passé ; le job validate s'est arrêté au typecheck avant les tests. Nouveau run requis après correction.


## 2026-11-14 — Client mobile : opérations de pré-partie

- RoomClient expose maintenant les quatre messages serveur : soumission du deck, déclaration keep/mulligan, choix des cartes à remettre et demande de démarrage.
- Les payloads sont typés avec les contrats CommanderDeckList et PregameClientMessage du monorepo.
- Le client parse et valide les réponses pregame-result avant de les transmettre aux abonnés ; accepted doit être un booléen.
- Tests unitaires du client couvrent les quatre types de message et le rejet d'une réponse de pré-partie mal formée.
- Limite : les appels sont maintenant disponibles dans RoomClient, mais les écrans React Native ne présentent pas encore l'interface deck/mulligan/choix de cartes ; le serveur de production n'injecte toujours pas de catalogue ni de politique Commander, donc répond PREGAME_NOT_CONFIGURED tant que cette configuration n'est pas fournie.

## 2026-11-14 — Transport WebSocket de la pré-partie

- Refactorisation du bootstrap serveur en factory createCommanderPocketServer, avec injection facultative de PregameCoordinatorFactory.
- Ajout des messages WebSocket pregame-submit-deck, pregame-mulligan, pregame-bottom et pregame-start.
- Les commandes utilisent les identifiants/jetons de la session de siège authentifiée ; le client ne peut pas choisir un autre joueur.
- La réponse contenant la GameView projetée est unicast au demandeur, sans diffusion de main privée aux autres connexions.
- Validation structurelle des payloads deck/mulligan/bottom et limite de trame WebSocket à 64 Kio.
- Sans factory injectée, les commandes répondent PREGAME_NOT_CONFIGURED : aucun catalogue ni contrôle de légalité fictif n'est utilisé.
- Le serveur de production démarre encore sans factory, car le dépôt ne fournit pas encore de catalogue serveur/version de politique Commander câblés au bootstrap.
- CI du commit de transport 767c144 : succès (typecheck, tests TypeScript et tests Python).

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
- Prochaine étape : intégrer cet adaptateur au gestionnaire WebSocket avec validation stricte des payloads, réponses ciblées au joueur et tests d'intégration de transport.

## 2026-11-14 — Validation atomique de la configuration des salles

- RoomRegistry.create valide le gameId, les quatre joueurs, l'unicité des identifiants, les noms non vides et les sièges exacts 0 à 3 avant de construire ou d'enregistrer une salle.
- Les configurations invalides échouent avec des codes explicites et ne laissent aucune entrée partielle dans le registre.
- Tests ajoutés pour les identifiants dupliqués, sièges dupliqués/hors plage, identifiant de salle vide et nombre de joueurs incorrect.
- CI GitHub Actions 43569526212, résultat à consulter.
- Limite : la pré-partie reste un service non branché au WebSocket/mobile ; la distribution actuelle des jetons reste réservée à un réseau local de confiance.
- Prochaine étape : exposer les commandes de pré-partie via un protocole de pré-partie authentifié, avec réponses ciblées au joueur et tests d'intégration WebSocket.

## 2026-11-13 — Coordinateur de pré-partie autoritaire

- Ajout du PregameCoordinator côté serveur : réception d'une liste de deck par siège, validation à partir du catalogue et de la politique de légalité fournis par le serveur, expansion en instances runtime, placement des commandants, mélange et distribution des mains initiales.
- Coordination des déclarations de mulligan simultanées, génération des graines côté serveur, choix privés des cartes à remettre sous la bibliothèque et démarrage uniquement lorsque les quatre joueurs ont gardé.
- Les vues existantes masquent toujours l'identité des mains adverses ; tests de non-régression ajoutés pour la confidentialité et les refus de decks invalides.
- CI GitHub Actions 43475390536, commit 15ce2127251c62f46897ba85994f1436b7dbc7f7 : validate (typecheck + Vitest) et python-data réussis.
- Limite actuelle : le coordinateur est un service serveur testable, mais il n'est pas encore raccordé aux messages WebSocket/mobile. La politique d'éligibilité Commander reste une dépendance versionnée injectée par le serveur ; aucune légalité client n'est acceptée.
- Prochaine étape : exposer ces opérations via un protocole de pré-partie authentifié, avec réponses ciblées au joueur et tests d'intégration de transport.

Journal append-only : ajouter une nouvelle entrée en tête, ne pas réécrire l'historique.
