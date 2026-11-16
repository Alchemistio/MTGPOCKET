# REPRISE — Commander Pocket

> Lire ici en premier après interruption.
> Workflow obligatoire : [DEVELOPMENT_WORKFLOW.md](DEVELOPMENT_WORKFLOW.md).

## Repères
- Repo : https://github.com/Alchemistio/MTGPOCKET
- Branche : `feat/commander-pocket-foundation`
- PR #1 : https://github.com/Alchemistio/MTGPOCKET/pull/1 — draft, non mergée. Aucun merge sans demande explicite.
- Stack : pnpm, TypeScript strict, Expo/React Native, Node/WebSocket, moteur partagé, Scryfall, SQLite, ETL Python.

## Dernière validation connue
- CI verte : run `43827956587`, SHA `1747a4a0540b62560efc58b8b626e7c4bea0f347`, jobs `validate` (typecheck + Vitest) et `python-data` réussis.
- Cette CI couvre : persistance de salle, reprise pré-partie, initialisation du checkpoint à create-room, vue restaurée au rejoin, reconnexion mobile automatique et test de redémarrage réel du processus Node avec SIGKILL/restart, réauthentification et rejeu idempotent.
- Les runs antérieurs `43826473231` et `43826793567` ont révélé deux assertions erronées dans le nouveau test mulligan ; elles ont été corrigées (premier mulligan gratuit, second mulligan, six cartes après bottom). Le run `43826978349` a validé la reprise pré-partie, `43827536943` la reconnexion mobile, puis `43827956587` l'ensemble avec le test OS.
- Les commits après le SHA CI sont documentaires uniquement. Aucun test local n'a été exécuté depuis cet environnement.

## État du code
- Moteur initial Commander : setup, mulligan de Londres, phases/priorité/pile, pioche, mana basique, cleanup, pertes, taxe et quelques sorts supportés.
- Pré-partie serveur + WebSocket/mobile : soumission des decks, validation par catalogue/policy serveur, mains privées, keep/mulligan, choix bottom, démarrage et première priorité.
- Salles autoritaires : journal des commandes acceptées, checkpoints versionnés, rejeu déterministe, stockage JSON atomique, permissions 0700/0600, hashes SHA-256 des jetons de siège.
- Pré-partie persistante :
  - Checkpoint privé défensif : état, decks soumis, déclarations keep/mulligan, choix bottom et journal de seeds.
  - Checkpoint vide persisté dès create-room ; chaque transition acceptée est écrite avant l'ACK.
  - Échec d'écriture : rollback du coordinateur vers le checkpoint précédent.
  - Au redémarrage, restauration du coordinateur et revalidation des decks avec le catalogue/policy injectés.
  - Au start, le checkpoint pré-partie est remplacé par le snapshot actif et le seed log.
- Reconnexion mobile :
  - Jusqu'à cinq tentatives exponentielles après fermeture inattendue.
  - Réauthentification avec le jeton de siège conservé en mémoire.
  - Vue serveur restaurée appliquée au retour de `room-joined`.
  - Après fermeture complète de l'app, les credentials ne sont pas persistés ; rejoindre manuellement avec le jeton.
- Test OS : le serveur de production est lancé dans un processus Node, crée une salle et persiste une commande, est tué puis relancé sur le même répertoire ; le test vérifie la réauthentification et l'idempotence.
- Les fichiers serveur sont conservés sous `data/server-rooms`, exclu de Git. Mains adverses, bibliothèques et seeds ne sont jamais projetées.

## Limites et blocages
- Aucun test sur appareils physiques ni LAN réel à deux/quatre téléphones.
- Découverte LAN et TLS/gestion de secrets de production non implémentées.
- Credentials mobiles non persistés après fermeture complète de l'app.
- Snapshot Scryfall réel et policy Commander de production non provisionnés/validés.
- Le moteur ne couvre pas les Comprehensive Rules ni toutes les cartes : permanents avancés, cibles, coûts alternatifs, combat détaillé et SBA générales restent incomplets.

## Prochaines actions — ordre recommandé
1. Tester sur au moins deux appareils iOS/Android sur le même Wi-Fi ; viser quatre appareils.
2. Provisionner et dater le snapshot Scryfall et la policy Commander officiels, sans inventer de légalité.
3. Ajouter la découverte LAN et renforcer la sécurité du transport/stockage des credentials avant une diffusion réelle.
4. Décider si la reconnexion doit survivre à la fermeture complète de l'app (stockage sécurisé Keychain/Keystore).
5. Continuer la couverture des règles Magic par capacités/effets, avec tests ciblés et aucune prétention de couverture exhaustive.
6. Revoir le gate M0.5 ; PR #1 reste draft jusqu'aux validations physiques et à une demande explicite de merge.

## Règles
- Lire `DEVELOPMENT_WORKFLOW.md` avant toute nouvelle tranche.
- CI verte sur le SHA exact ≠ test simulateur ≠ test appareil.
- Mettre à jour ce fichier et le journal après chaque avancée.
- Ne jamais exposer GameState brut, les mains adverses, les hashes/jetons de siège ou les seeds.
