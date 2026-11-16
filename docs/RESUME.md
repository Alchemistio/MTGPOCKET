# REPRISE — Commander Pocket

> Lire ici en premier après interruption. État courant seulement. Mettre à jour à chaque avancée.
> Workflow obligatoire : [DEVELOPMENT_WORKFLOW.md](DEVELOPMENT_WORKFLOW.md).

## Repères
- Repo: https://github.com/Alchemistio/MTGPOCKET
- Branche de travail: `feat/commander-pocket-foundation`
- PR #1: https://github.com/Alchemistio/MTGPOCKET/pull/1 — draft, non mergée. Stabiliser avant merge ; aucun merge sans demande explicite.
- Stack: pnpm, TypeScript strict, Expo/React Native, Node/WebSocket, moteur partagé, Scryfall, SQLite, ETL Python.
- Décision produit/process: merger la fondation après une courte stabilisation. La couverture exhaustive des Comprehensive Rules n'est pas un prérequis ; elle reste incrémentale dans M2.

## Dernier état connu
- CI de référence avant persistance : run `43689458355` sur SHA `7d6b320983270638d829ec51995ca593cfa65f79`, jobs `validate` et `python-data` verts.
- Première CI de la tranche persistence : run `43806846271` sur le merge ref de la PR correspondant au HEAD `66bae087`. Typecheck et `python-data` réussis ; Vitest échoue sur 3 tests pré-partie à cause d'un garde-fou incorrect (il supposait que l'état initial GameRoom avait `status=pregame`, alors que la salle vide est `active` avec `deckSetupComplete=false`).
- Correctif appliqué dans `7df71f3` : les nouvelles salles pré-partie restent accessibles ; seules les salles restaurées depuis disque ou dont le deck est prêt sont bloquées. Les checkpoints ont ensuite été versionnés aussi par `engineVersion` (`c99b826` / `dd1c331`). Aucun run CI n'est encore observé sur le HEAD actuel.
- Dernière tranche de code ajoutée :
  - `GameRoom.checkpoint` exporte une copie du snapshot autoritaire et du journal versionné.
  - `GameRoom.restore` reconstruit la salle en rejouant chaque commande acceptée et vérifie versions, révisions et résultats.
  - `JsonFileRoomPersistence` écrit des enregistrements JSON versionnés par écriture temporaire + fsync + rename ; répertoire 0700, fichiers 0600.
  - Les jetons de siège sont stockés uniquement sous forme de hash SHA-256 ; les jetons bruts restent remis aux clients à la création et ne sont pas persistés.
  - `RoomRegistry` restaure les salles au démarrage, persiste les commandes acceptées avant l'ACK WebSocket et restaure l'ancien checkpoint si l'écriture échoue.
  - Au démarrage de la partie, le snapshot validé et le seed log de pré-partie sont persistés. Les seeds ne sont jamais projetés dans les vues joueur.
  - Répertoire par défaut : `data/server-rooms`, exclu de Git.
- Tests ajoutés pour restauration/rejeu du checkpoint, idempotence après redémarrage, intégrité du journal, stockage atomique, permissions, hash des jetons, persistance des seeds, rollback disque et refus de recréer un coordinateur de pré-partie volatil après redémarrage. Sur le run 43806846271, les tests de stockage et RoomRegistry ont passé ; les tests de pré-partie ont révélé le garde-fou incorrect, corrigé ensuite. CI du HEAD actuel à vérifier.

## Fait précédemment
- 4 sièges, salle LAN, jetons, WebSocket, vues privées par siège.
- Moteur: tours/phases/priorité/pile de base; PV, pioche, taxes, commandant, élimination.
- Pré-partie serveur + transport: deck, mulligan, bottom, start; après start, le GameRoom reçoit le même état validé, les mains et instances, et démarre à upkeep avec priorité.
- Test WebSocket automatisé à quatre sièges : decks, keep, démarrage, mains privées et première passe.
- Mobile: plateau paysage, télémétrie, client LAN, recherche Scryfall, deckbuilder minimal + modal pré-partie.
- Données: cache SQLite mobile; import MTGJSON Python.
- Catalogue serveur: loader snapshot Scryfall + policy Commander versionnée; validation fail closed.
- Générateur bulk Scryfall streaming: manifeste, default_cards, SHA-256, provenance, écriture atomique, tests.

## Bloqueurs et limites
- La persistance est nouvellement câblée mais pas encore validée par CI sur le SHA courant.
- L'état intermédiaire de pré-partie (decks soumis, déclarations keep/mulligan, bottom choices) n'est pas encore persisté. Le seed log est durablement écrit au démarrage de la partie, pas avant.
- La restauration des sorts/effets exige que le serveur redémarre avec le même catalogue et les mêmes handlers déterministes ; en cas de mismatch de version/résultat, la restauration échoue volontairement.
- La reconnexion/réauthentification automatique mobile n'est pas implémentée.
- Snapshot réel Scryfall non provisionné ; policy Commander réelle non validée.
- Le jeu n'est pas complet : seuls quelques effets exacts sont pris en charge ; permanents, cibles, coûts avancés, combat détaillé et SBA générales restent incomplets.
- Aucun test sur appareils physiques ; aucun test LAN à quatre téléphones.

## Prochaines actions — ordre recommandé
1. Lire les logs CI du dernier commit de code et corriger toute erreur de typecheck/test.
2. Compléter un test de redémarrage de serveur réel : création de salle, commande acceptée, arrêt, nouveau registre, réauthentification par token et rejeu exact.
3. Persister les transitions de pré-partie et leurs seeds au fil des actions, sans exposer de données privées.
4. Implémenter reconnexion/réauthentification mobile et synchronisation depuis la vue serveur restaurée.
5. Test physique minimum à deux appareils sur le même Wi-Fi ; viser quatre appareils.
6. Revoir le diff et les critères M0.5, puis demander le merge de PR #1 lorsque le gate est satisfait.

## Règles
- Workflow: DEVELOPMENT_WORKFLOW.md; avant d'attendre CI, vérifier et terminer toutes les actions indépendantes possibles.
- CI commit exact; codé ≠ CI ≠ appareil testé.
- Mettre ce fichier à jour après chaque avancée; état courant seulement.
- PR #1 reste draft et non mergée sans demande explicite.
- Ne jamais exposer GameState brut, les mains adverses, les hashes/jetons de siège ou les seeds aux clients.
