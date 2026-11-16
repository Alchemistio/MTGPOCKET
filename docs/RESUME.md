# REPRISE — Commander Pocket

> Lire ici en premier après interruption.
> Workflow obligatoire : [DEVELOPMENT_WORKFLOW.md](DEVELOPMENT_WORKFLOW.md).

## Repères
- Repo : https://github.com/Alchemistio/MTGPOCKET
- Branche : `feat/commander-pocket-foundation`
- PR #1 : https://github.com/Alchemistio/MTGPOCKET/pull/1 — draft, non mergée. Aucun merge sans demande explicite.
- Stack : pnpm, TypeScript strict, Expo/React Native, Node/WebSocket, moteur partagé, Scryfall, SQLite, ETL Python.

## Dernière validation connue
- Dernière CI verte sur le code ETB + intégration WebSocket : run `43872357368`, SHA `76151c79384ca6018e81b47fdc1534d51eeb18ff` (`validate` + `python-data`). Typecheck, 55 tests serveur, 30 moteur, 10 mobile et Python data réussis. Les commits documentaires suivants ne changent pas le code.
- Dernière CI de code validée avant ETB : run `43869469546`, SHA `d163da9` (`validate` + `python-data`), couvrant les permanents vanilla, la pose de terrain de base, les migrations de checkpoints, la reconnexion et le redémarrage OS.
- Cette CI couvre : persistance de salle, reprise pré-partie, initialisation du checkpoint à create-room, vue restaurée au rejoin, reconnexion mobile automatique et test de redémarrage réel du processus Node avec SIGKILL/restart, réauthentification et rejeu idempotent.
- Les runs antérieurs `43826473231` et `43826793567` ont révélé deux assertions erronées dans le nouveau test mulligan ; elles ont été corrigées (premier mulligan gratuit, second mulligan, six cartes après bottom). Le run `43826978349` a validé la reprise pré-partie, `43827536943` la reconnexion mobile, puis `43827956587` l'ensemble avec le test OS.
- Les commits après le SHA CI sont documentaires uniquement. Aucun test local n'a été exécuté depuis cet environnement.

- Permanents vanilla : première tranche implémentée (créatures, artefacts, enchantements sans texte Oracle), paiement simple, timing de phase principale, pile puis champ de bataille ; UI mobile et projection publique/privée ajoutées. CI initiale `43867439926` a passé typecheck/Python mais échoué sur un fixture de test incomplet (`deckSetupComplete` manquant), corrigé dans `7601209`/`c8ff02a`. Les commits après le SHA validé sont documentaires uniquement ; aucun code non testé n’a été ajouté ensuite.

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

- Permanents vanilla : créatures, artefacts et enchantements normaux à coût simple ; lancement en phase principale, paiement, pile et arrivée sur le champ de bataille. Deux ETB targetless sont pris en charge via allowlist stricte (pioche 1 ou gain de vie N).

- Action spéciale « jouer un terrain de base » ajoutée : un par tour, joueur actif en phase principale avec priorité et pile vide ; déplacement direct sur le champ de bataille sans pile/paiement. Compteur visible et UI mobile mis à jour. Migrations rétrocompatibles des checkpoints salle/pré-partie. CI verte : run `43869469546`, SHA `d163da9` (`validate` + `python-data`). Tests physiques non effectués.

## Base de règles et mémoire de recherche
- Source courante importée : Comprehensive Rules 2026-11-06 ; édition 2026-09-25 archivée depuis le PDF fourni.
- Index : 3 182 règles/sous-règles, 148 titres, 744 entrées de glossaire ; fichiers JSONL par chapitre, index maître, manifest et générateur Python.
- Recherche et plans de modules : `memory/memory_index.md`, `memory/rules/rules_index.md`, `memory/rules/engine_architecture.md` et `memory/rules/etb/`.
- La stratégie générique complète M0–M6 ; elle ne remplace aucune priorité réseau, mobile, données ou validation déjà planifiée.
- Les résumés et mots-clés automatiques servent à retrouver les paragraphes ; le texte officiel et ses renvois font autorité.

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


## Reprise ETB — 16 novembre 2026
- Début de ETB-0 : contrat `ZoneChangeEvent` ajouté dans `packages/game-engine/src/zone-events.ts` et exporté par le moteur.
- Le chemin de résolution d'un sort permanent construit maintenant un événement déterministe (`zone-change:<stack-item-id>`) à partir des snapshots avant/après, conserve le contrôleur avant/après et le LKI, puis associe son identifiant au trigger ETB allowlisté.
- La détection ETB existante reste limitée aux deux templates targetless ; le contrat ne prétend pas encore traiter les remplacements, les changements simultanés, les SBA induites ou les autres sources d'entrée.
- Tests moteur dédiés au contrat (transition, LKI, contrôleur avant/après, no-op et incohérence d'instance) et tests du transport serveur pour vérifier l'identifiant d'événement dans les deux triggers déjà supportés. Tests non exécutés depuis cet environnement ; la CI doit valider le commit.
- Prochaine tranche : faire passer les autres transitions de zone par un dispatcher métier unique, puis traiter remplacements et groupes simultanés avant d'élargir le parseur Oracle.


## ETB — tranche batch simultané (2026-11-16)
- Ajout de `moveCardsToZoneSimultaneously` dans le moteur partagé, avec une liste de requêtes, validation des identifiants dupliqués/instances inconnues, snapshots pris sur le même état pré-événement et un `simultaneousGroupId` commun.
- Un événement commis par carte est émis pour chaque transition réelle ; les no-op n'émettent pas d'événement. Les mouvements sont immuables et aucun état intermédiaire n'est retourné.
- Tests ajoutés pour deux cartes entrant depuis des zones distinctes, groupe partagé, état initial inchangé, no-op et requêtes dupliquées.
- Limite : ce batch est une primitive d'agrégation, pas le moteur complet 614/616. Il ne choisit pas lui-même les remplacements, ne gère pas les coûts/choix de 614.12a-b, ni les événements imbriqués de 614.13 ; les règles Commander déjà existantes restent traitées par le chemin existant.
- Commit de code : `104ae254fac73bb7a068ccd025b9d78b0b2c26bb`. CI non encore visible sur ce SHA ; tests non exécutés localement.
- Références étudiées dans le PDF CR fourni (2026-09-25) : 603.2c, 603.2g, 603.3a-b, 603.6a-d, 614.12-614.13, 616.1a-g, 700.1 et 608.2e-f.


- Suite ETB-0 : ajout de `moveCardToZoneWithEvent`, wrapper canonique d'une transition unique ; la résolution d'un sort permanent côté serveur passe désormais par ce processeur. Le batch simultané reste disponible pour les groupes. Test moteur dédié ajouté. Commit code : `97993177b76c9240629a8b2d8a990f7ad8a34b24`. CI à vérifier sur le SHA exact.
