# REPRISE — Commander Pocket

> Lire ici en premier après interruption. État courant seulement.
> Workflow obligatoire : [DEVELOPMENT_WORKFLOW.md](DEVELOPMENT_WORKFLOW.md).

## Repères
- Repo : https://github.com/Alchemistio/MTGPOCKET
- Branche : `feat/commander-pocket-foundation`
- PR #1 : https://github.com/Alchemistio/MTGPOCKET/pull/1 — draft, non mergée. Aucun merge sans demande explicite.
- Stack : pnpm, TypeScript strict, Expo/React Native, Node/WebSocket, moteur partagé, Scryfall, SQLite, ETL Python.

## Dernière validation connue
- Dernière CI verte observée avant la tranche de pré-partie persistante : run `43807266906`, commit `e00d679a03b0ddfacae7c1d95eacff8daf349245`, conclusion `success`.
- Ce run ne couvre PAS les commits de pré-partie persistante ci-dessous. Run `43826473231` (merge ref associé à `b0162da`) : typecheck et `python-data` verts, Vitest a échoué sur une assertion du nouveau test de reprise. La cause était une hypothèse erronée : le premier mulligan est gratuit et ne requiert pas de bottom ; le test effectue maintenant un second mulligan avant bottom (`a58a513`). CI sur le HEAD corrigé encore à obtenir.
- Aucun test local n'a été exécuté depuis cet environnement. Aucun test de processus serveur réellement arrêté/redémarré, aucun test physique, aucun test LAN à quatre téléphones n'est revendiqué.

## État du code
- Moteur initial Commander : setup, mulligan de Londres, phases/priorité/pile, pioche, mana basique, cleanup, pertes, taxe et quelques sorts supportés.
- Pré-partie serveur + WebSocket/mobile : soumission des decks, validation par catalogue/policy serveur, mains privées, keep/mulligan, choix bottom, démarrage et première priorité.
- Salles autoritaires : journal des commandes acceptées, checkpoints versionnés, rejeu déterministe, stockage JSON atomique, permissions 0700/0600, hashes SHA-256 des jetons de siège.
- Pré-partie persistante ajoutée dans la tranche courante :
  - `PregameCoordinator.checkpoint` capture l'état de pré-partie, les decks soumis, les déclarations keep/mulligan et le journal de seeds dans une copie défensive.
  - Chaque transition acceptée est écrite dans le checkpoint privé avant l'ACK WebSocket.
  - Échec d'écriture : le coordinateur revient au checkpoint précédent et l'action est refusée.
  - Au redémarrage, le coordinateur est reconstruit à partir du checkpoint et les decks sont revalidés avec le catalogue/policy injectés.
  - Le démarrage remplace le checkpoint pré-partie par le snapshot actif du GameRoom et le seed log.
  - Les tests couvrent plusieurs reconstructions de RoomRegistry au cours d'une pré-partie, dont les decks partiels, mulligan en attente, second mulligan, cartes bottomées et seeds ; un test WebSocket reconstruit aussi le runtime serveur et vérifie qu'un deck déjà soumis reste reconnu.
- Le serveur de production conserve les fichiers sous `data/server-rooms`, exclu de Git. Les mains, bibliothèques et seeds ne sont jamais projetées dans les vues client.

## Limites et blocages
- La dernière CI sur le code courant a révélé une seule assertion de test erronée ; le correctif est commité, mais le nouveau HEAD doit encore passer CI.
- Le test de reprise pré-partie reconstruit plusieurs registres dans le même processus de test. Il faut encore valider un vrai arrêt/redémarrage du processus serveur.
- La reconnexion/réauthentification automatique mobile n'est pas implémentée.
- Le snapshot Scryfall réel et la policy Commander de production ne sont pas provisionnés/validés.
- Le moteur ne couvre pas les Comprehensive Rules ni toutes les cartes : permanents avancés, cibles, coûts alternatifs, combat détaillé et SBA générales restent incomplets.
- Aucun test sur appareils physiques ; aucun test LAN à quatre téléphones.

## Prochaines actions — ordre recommandé
1. Vérifier la CI sur le HEAD courant et corriger les erreurs.
2. Ajouter un test de redémarrage du processus serveur réel avec réauthentification par jeton et rejeu exact.
3. Implémenter reconnexion/réauthentification automatique mobile et synchronisation depuis la vue serveur restaurée.
4. Tester au minimum deux appareils sur le même Wi-Fi ; viser quatre appareils.
5. Provisionner et dater le snapshot Scryfall et la policy Commander officiels, sans inventer de légalité.
6. Revoir le gate M0.5 ; PR #1 reste draft jusqu'à validation et demande explicite de merge.

## Règles
- Lire `DEVELOPMENT_WORKFLOW.md` avant toute nouvelle tranche.
- CI verte sur le SHA exact ≠ test de processus ≠ test simulateur ≠ test appareil.
- Mettre à jour ce fichier et le journal après chaque avancée.
- Ne jamais exposer GameState brut, les mains adverses, les hashes/jetons de siège ou les seeds.
