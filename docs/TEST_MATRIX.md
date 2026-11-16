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
| Salle LAN | `apps/server/test/game-room.test.ts`, `apps/server/test/room-registry.test.ts` | Island/Wastes tap-for-mana, anti double-tap, Divination/pioches, gain de vie, refus texte inconnu, instant/réponse, LIFO, cleanup, replay, checkpoint restauré, idempotence, persistance avant ACK et rollback disque | terrains non basiques, permanents non-terrain, cibles/contres, coûts avancés, crash de processus réel, persistance du seed log avant start, reconnexion |
| Pré-partie | `apps/server/test/pregame-coordinator.test.ts`, `apps/server/test/pregame-session-registry.test.ts`, `apps/server/test/server-pregame-transport.test.ts` | validation serveur des quatre decks, création des instances, mains initiales, mulligan, capture des graines côté serveur, transfert au GameRoom, vues privées à quatre sièges, première commande WebSocket, restauration des decks soumis/déclarations/choix bottom/seeds depuis checkpoint entre plusieurs reconstructions du registre | crash réel du processus serveur, tour complet avec sort/réponse/résolution/cleanup, catalogue/banlist de production |
| Vues privées | `apps/server/test/player-view.test.ts` | main du propriétaire visible seulement par lui, bibliothèque masquée, choix Commander privé, statut explicite `pregame`/`active` | audit complet des champs sensibles et tests fuzz |
| Registre de salle | `apps/server/test/room-registry.test.ts` | création, hash des jetons, restauration après redémarrage, persistance des seeds, rollback si écriture échoue | rotation/expiration des jetons, test multi-processus |
| Persistance disque | `apps/server/test/room-persistence.test.ts` | round-trip versionné, écriture atomique, permissions 0600, absence de jeton brut, validation JSON/credentials/seeds | crash injection entre fsync/rename, corruption du snapshot complet, migrations de schéma |
| Checkpoint / replay | `apps/server/test/game-room.test.ts` | checkpoint défensif, restauration par rejeu, idempotence après restauration, refus d'un résultat d'événement altéré | tests de redémarrage du processus serveur et compatibilité entre versions moteur |
| Client mobile réseau | `apps/mobile/test/room-client.test.ts` | handshake, commandes versionnées, rejet de message mal formé, fermeture avant ouverture, timeouts de connexion/handshake/action pré-partie, fermeture explicite et rejet d'un ACK tardif | reconnexion/réauthentification automatique, tests UI et appareils |

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

Dernier run complet vérifié : **43689458355**, commit `7d6b320983270638d829ec51995ca593cfa65f79`, jobs `validate` (typecheck + Vitest) et `python-data` réussis.

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

Les tests de checkpoint, stockage disque et RoomRegistry passent dans le run 43806846271 ; le même run a échoué sur trois tests pré-partie à cause d'un garde-fou erroné. Le typecheck et python-data étaient verts. Le garde-fou a été corrigé dans 7df71f3, puis le checkpoint a reçu un champ engineVersion. Aucun run CI n'est encore observé sur le HEAD actuel ; aucune validation de cette tranche n'est revendiquée. Aucun test de redémarrage de processus réel ni test sur appareil n'est revendiqué.


## Pré-partie persistante — ajout 2026-11-16

- `PregameCoordinator.checkpoint` capture l'état, les decks soumis, les déclarations keep/mulligan et les seeds dans une copie défensive.
- `RoomRegistry` persiste le checkpoint à chaque transition acceptée avant l'ACK ; en cas d'échec disque, le coordinateur revient au checkpoint précédent.
- Le test `pregame-session-registry.test.ts` reconstruit plusieurs registres à partir du même stockage et vérifie la reprise après decks partiels, déclaration mulligan en attente, cartes bottomées et seeds.
- La restauration revalide les decks avec le catalogue et la policy injectés ; une salle pré-partie restaurée sans checkpoint, ou avec checkpoint invalide, reste fermée.
- Tests écrits mais pas encore validés par CI sur le nouveau HEAD. Ce scénario reconstruit les registres dans le même processus de test ; il ne remplace pas encore un redémarrage de processus serveur réel.
