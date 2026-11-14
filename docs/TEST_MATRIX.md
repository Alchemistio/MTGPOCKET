# Matrice de tests et couverture

Dernière revue : 2026-11-14. Cette matrice décrit les tests présents dans le dépôt, pas une certification complète des règles Magic.

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
| Salle LAN | `apps/server/test/game-room.test.ts` | Divination et pioche via résolveur exact, instant/réponse, LIFO, paiement, tour main 1 → upkeep suivant, cleanup/défausse et replay | permanents, cibles/contres, coûts avancés, persistance durable, seed transcript, reconnexion |
| Pré-partie | `apps/server/test/pregame-coordinator.test.ts`, `apps/server/test/pregame-session-registry.test.ts`, `apps/server/test/server-pregame-transport.test.ts` | validation serveur des quatre decks, création des instances, mains initiales, mulligan, transfert au GameRoom, vues privées à quatre sièges et première commande de priorité via WebSocket | tour complet avec sort/réponse/résolution/cleanup, catalogue/banlist de production |
| Vues privées | `apps/server/test/player-view.test.ts` | main du propriétaire visible seulement par lui, bibliothèque masquée, choix Commander privé, statut explicite `pregame`/`active` | audit complet des champs sensibles et tests fuzz |
| Registre de salle | `apps/server/test/room-registry.test.ts` | création, jetons et authentification de siège | rotation/expiration des jetons |
| Client mobile réseau | `apps/mobile/test/room-client.test.ts` | handshake, commandes versionnées et rejet de message mal formé; le panneau pré-partie consomme les vues privées et attend le statut `active` | tests UI, reconnexion, timeout, perte réseau et tests appareils |

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

Dernier run complet vérifié : **43475390536**, commit `15ce2127251c62f46897ba85994f1436b7dbc7f7`, jobs `validate` et `python-data` réussis.

## Validation non automatisée — non encore réalisée

- Build iOS et Android avec modules natifs Expo.
- Tests sur téléphones physiques 5,5–6,7 pouces, en paysage et avec rotation verrouillée.
- VoiceOver, TalkBack, tailles de police, contraste et motifs WUBRG.
- Test de quatre appareils sur Wi-Fi réel, perte/reprise réseau et changement d'adresse IP.
- Profilage mémoire, CPU, consommation batterie et import bulk sur appareil cible.

Ne jamais déduire la validation native de la seule réussite de TypeScript ou Vitest.
