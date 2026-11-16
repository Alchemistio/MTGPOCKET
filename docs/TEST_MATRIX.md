
## Jouer un terrain de base — ajout 2026-11-16, CI verte

- Moteur : le compteur `landsPlayedThisTurn` est initialisé à zéro et réinitialisé uniquement quand le joueur devient actif au début de son tour.
- Serveur : `play-land` déplace un terrain de base de la main au champ de bataille sans pile ni paiement ; une deuxième pose est rejetée ; hors phase principale, la carte reste en main.
- Vues : la main privée expose `isSupportedLand`, le compteur public est projeté, les mains adverses restent cachées.
- WebSocket : le scénario quatre sièges vérifie la pose depuis la main et l'affichage public du terrain.
- Compatibilité : tests de migration des anciens checkpoints de salle et de pré-partie sans compteur.
- Run `43869469546` sur `d163da9` : typecheck, 53 tests serveur, 30 tests moteur, 10 tests mobile et `python-data` verts ; la pose de terrain WebSocket, les migrations et le reset du compteur sont couverts.


## Permanents vanilla — ajout 2026-11-16, CI verte
- Run `43867439926` : typecheck et Python réussis ; Vitest échoue uniquement sur le test négatif de timing car son état de fixture n'indiquait pas que le setup de deck était terminé. Fixture corrigé dans `7601209`, assertions de frontières élargies dans `c8ff02a`. Nouveau run CI requis.

- `game-room.test.ts` : lancer une créature vanilla depuis la main, payer un coût coloré + générique, empiler le sort, résoudre après les quatre passes, déplacer l'instance sur le champ de bataille du contrôleur et vérifier le rejeu.
- Test négatif : lancer un permanent hors phase principale est refusé sans dépenser de mana.
- `player-view.test.ts` : le propriétaire voit le permanent jouable dans sa main, les autres sièges ne voient pas sa main, et le champ de bataille expose le permanent public.
- Les cartes avec texte Oracle non vide, les cartes multi-face, commandants, terrains, cibles et coûts non simples restent hors de cette tranche.
- Run `43867856511` sur `f93d82b` : typecheck, Vitest et Python verts pour les tests unitaires de permanents et la projection. Le run `43868236829` sur `0c55bdb` valide aussi le test WebSocket quatre sièges : lancement, résolution, vue publique du permanent et confidentialité des mains adverses.
- CI et relecture complète du diff requises avant de cocher la roadmap.

# Matrice de tests et couverture

Dernière revue : 2026-11-16. Cette matrice décrit les tests présents dans le dépôt, pas une certification complète des règles Magic.

## Moteur de règles

| Domaine | Tests | Ce qui est vérifié | Lacunes majeures |
|---|---|---|---|
| Création de partie / priorité | `packages/game-engine/test/game.test.ts` | 4 sièges, 40 PV, rotation priorité, transition d'étape, élimination, choix Commander bloquant | fenêtres de priorité conditionnelles, actions spéciales |
| Zones / Commander | `packages/game-engine/test/cards.test.ts` | déplacement entre zones, taxe, dégâts de commandant, choix retour depuis cimetière/exil, remplacement main/bibliothèque | CR 903.9c, remplacement concurrent, changement de contrôle |
| Élimination | `packages/game-engine/test/elimination.test.ts` | retrait des objets possédés, exil des objets contrôlés appartenant à d'autres | effets continus, attachements complexes, départs simultanés |
| Bibliothèque / pioche | `packages/game-engine/test/library.test.ts` | pioche, bibliothèque vide et état de bibliothèque | effets de remplacement de pioche |
| Mulligan | `packages/game-engine/test/pregame.test.ts` | mulligan de Londres, premier mulligan gratuit, cartes bottom et neuf mulligans successifs | choix simultanés plus complexes et effets d'ouverture |
| Pile | `packages/game-engine/test/stack.test.ts` | empilement, passes, résolution générique | déclenchements réels, APNAP, copies, cibles et coûts |
| Phases/étapes | `packages/game-engine/test/turn-actions.test.ts` | séquence initiale, actions automatiques, nettoyage | combat réel, SBA complètes, fenêtres conditionnelles |

## Serveur et protocole

| Domaine | Tests | Ce qui est vérifié | Lacunes majeures |
|---|---|---|---|
| Salle LAN | `apps/server/test/game-room.test.ts`, `apps/server/test/room-registry.test.ts` | Island/Wastes tap-for-mana, anti double-tap, Divination/pioches, gain de vie, refus texte inconnu, instant/réponse, LIFO, cleanup, replay, checkpoint restauré, idempotence, persistance avant ACK et rollback disque | terrains non basiques, permanents non-terrain, cibles/contres, coûts avancés, CI du nouveau test de processus réel à confirmer, persistance du seed log avant start, reconnexion après fermeture app |
| Pré-partie | `apps/server/test/pregame-coordinator.test.ts`, `apps/server/test/pregame-session-registry.test.ts`, `apps/server/test/server-pregame-transport.test.ts` | validation serveur des quatre decks, création des instances, mains initiales, mulligan, capture des graines côté serveur, transfert au GameRoom, vues privées à quatre sièges, première commande WebSocket, restauration des decks soumis/déclarations/choix bottom/seeds depuis checkpoint entre plusieurs reconstructions du registre | crash réel du processus serveur, tour complet avec sort/réponse/résolution/cleanup, catalogue/banlist de production |
| Vues privées | `apps/server/test/player-view.test.ts` | main du propriétaire visible seulement par lui, bibliothèque masquée, choix Commander privé, statut explicite `pregame`/`active` | audit complet des champs sensibles et tests fuzz |
| Registre de salle | `apps/server/test/room-registry.test.ts` | création, hash des jetons, restauration après redémarrage, persistance des seeds, rollback si écriture échoue | rotation/expiration des jetons, test multi-processus |
| Persistance disque | `apps/server/test/room-persistence.test.ts` | round-trip versionné, écriture atomique, permissions 0600, absence de jeton brut, validation JSON/credentials/seeds | crash injection entre fsync/rename, corruption du snapshot complet, migrations de schéma |
| Checkpoint / replay | `apps/server/test/game-room.test.ts` | checkpoint défensif, restauration par rejeu, idempotence après restauration, refus d'un résultat d'événement altéré | tests de redémarrage du processus serveur et compatibilité entre versions moteur |
| Client mobile réseau | `apps/mobile/test/room-client.test.ts` | handshake, commandes versionnées, rejet de message mal formé, fermeture avant ouverture, timeouts de connexion/handshake/action pré-partie, fermeture explicite, rejet d'un ACK tardif, reconnexion automatique avec jeton de siège et resynchronisation de la vue | reprise après fermeture complète de l'app, tests UI et appareils |

## Données

| Domaine | Tests | Ce qui est vérifié | Lacunes majeures |
|---|---|---|---|
| Client cartes | `packages/card-data/test/client.test.ts` | requêtes Scryfall, en-têtes et cadence/cache client | contrat live exhaustif, retries 429/503 |
| Deck Commander | `packages/card-data/test/commander-deck.test.ts` | 100 cartes, singleton, identité couleur, légalité et commandants | banlist versionnée complète, exceptions avancées |
| Repository cartes | `packages/card-data/test/repository.test.ts` | normalisation et repository/cache | index local complet et layouts nouveaux |
| Import MTGJSON | `scripts/test_import_mtgjson.py` | parsing, extraction SQLite, checksum et cas compressé fixture | dump complet réel, interruption/reprise, mémoire sous charge |

## Validation CI actuelle

Workflow `.github/workflows/ci.yml` :
- `pnpm typecheck`
- `pnpm test` (Vitest sur les packages)
- `python -m unittest discover -s scripts -p "test_*.py"`

Dernier run entièrement vert avant la tranche de pré-partie persistante : **43807266906**, commit `e00d679a03b0ddfacae7c1d95eacff8daf349245`, jobs `validate` et `python-data` réussis.

## Validation non automatisée — non encore réalisée

- Build iOS et Android avec modules natifs Expo.
- Tests sur téléphones physiques 5,5–6,7 pouces, en paysage et avec rotation verrouillée.
- VoiceOver, TalkBack, tailles de police, contraste et motifs WUBRG.
- Test de quatre appareils sur Wi-Fi réel, perte/reprise réseau et changement d'adresse IP.
- Profilage mémoire, CPU, consommation batterie et import bulk sur appareil cible.

Ne jamais déduire la validation native de la seule réussite de TypeScript ou Vitest.


## Complément — Client mobile réseau (2026-11-15)

- Tests ajoutés pour fermeture avant ouverture, délais de connexion/handshake, fermeture explicite pendant handshake et timeout d'action pré-partie avec verrouillage jusqu'à reconnexion. Reconnexion automatique et UI native restent hors couverture.


## Persistance et reprise — ajout 2026-11-16

Le run **43807266906** est vert sur `e00d679`, avant les nouveaux checkpoints pré-partie. Les runs **43826473231** et **43826793567** ont passé typecheck et `python-data`, mais Vitest a détecté deux assertions incorrectes du test de reprise du mulligan. La séquence a été corrigée (premier mulligan gratuit, second mulligan, six cartes après bottom) dans `eca67c0`. Le run **43826978349** sur `82eb670` est vert pour la reprise pré-partie et le rejoin WebSocket. Le run **43827536943** sur `3a95375` est également entièrement vert (`validate` et `python-data`) et couvre en plus la reconnexion mobile automatique et sa réauthentification. Le run **43827768778** sur `bd1972a` valide l’initialisation du checkpoint à create-room. Le run **43827956587** sur `1747a4a` est entièrement vert (`validate` + `python-data`) et couvre aussi le test de redémarrage du processus OS décrit ci-dessous. Aucun redémarrage de processus OS ni test sur appareil n'est revendiqué.


## Pré-partie persistante — ajout 2026-11-16

- `PregameCoordinator.checkpoint` capture l'état, les decks soumis, les déclarations keep/mulligan et les seeds dans une copie défensive.
- `RoomRegistry` persiste le checkpoint à chaque transition acceptée avant l'ACK ; en cas d'échec disque, le coordinateur revient au checkpoint précédent.
- Le test `pregame-session-registry.test.ts` reconstruit plusieurs registres à partir du même stockage et vérifie la reprise après decks partiels, déclaration mulligan en attente, cartes bottomées et seeds.
- La restauration revalide les decks avec le catalogue et la policy injectés ; une salle pré-partie restaurée sans checkpoint, ou avec checkpoint invalide, reste fermée.
- Tests écrits mais pas encore validés par CI sur le nouveau HEAD. Ce scénario reconstruit les registres dans le même processus de test ; il ne remplace pas encore un redémarrage de processus serveur réel.


## Reconnexion mobile — ajout 2026-11-16

- `RoomClient` conserve en mémoire l'URL et les credentials du siège après create/join.
- Après une fermeture inattendue, il effectue jusqu'à cinq tentatives exponentielles, rejoint de nouveau la salle avec le même jeton et émet la vue autoritaire restaurée.
- L'app conserve le dernier plateau pendant la reconnexion, applique la nouvelle vue au `room-joined` et signale l'échec après épuisement des essais.
- Test unitaire avec sockets simulées : perte de connexion, réauthentification et réception de la nouvelle vue.
- Les credentials ne sont pas persistés après fermeture complète de l'app ; aucun test sur appareil ni sur réseau mobile réel n'est effectué. CI de cette tranche à confirmer.


## Redémarrage réel du serveur — test ajouté 2026-11-16

- `server-process-restart.test.ts` lance deux instances successives du serveur de production dans des processus Node séparés, avec le même répertoire persistant.
- Vérifie création de salle, commande acceptée, arrêt forcé du premier processus, restauration au second démarrage, réauthentification par jeton et rejeu idempotent de la même commande.
- Le run CI **43827956587** sur `1747a4a` passe avec ce test. Il valide le cycle OS process restart en environnement CI, pas un déploiement en production ni le réseau physique.


## ETB simples — ajout 2026-11-16

- Allowlist exacte de deux textes auto-référentiels : « When {nom} enters the battlefield, draw a card. » et « When {nom} enters the battlefield, you gain {N} life. » ; un texte proche (scry ou nombre écrit en lettres) est refusé.
- Le sort permanent résout vers le champ de bataille ; chaque capacité est ensuite ajoutée comme `triggered-ability` distincte, avant la priorité, avec source et contrôleur conservés.
- Résolution testée : pioche d'une carte ou gain de vie ; le changement d'état n'arrive qu'à la résolution du trigger. Rejeu déterministe et restauration checkpoint couverts.
- `player-view.test.ts` : l'ETB supporté est signalé jouable dans la main privée du propriétaire ; aucune main adverse n'est exposée.
- WebSocket authentifié à quatre sièges : lancement d'un permanent vanilla, ETB pioche, puis ETB gain de vie ; vérification de la pile et de la confidentialité des mains.
- Limites : deux effets targetless, sans cible ni choix ; APNAP, triggers simultanés et déclenchements d'autres événements non couverts.
- CI verte : run `43872836544`, SHA `199194aa6f756bde42a8658aeb5a9595fbc6838a` ; typecheck, 56 tests serveur, 30 moteur, 10 mobile et `python-data` réussis.
