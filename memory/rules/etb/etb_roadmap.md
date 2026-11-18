# ETB — roadmap du module complet

Cette roadmap complète `docs/ROADMAP.md`. Elle privilégie une mécanique générique plutôt qu'une progression carte par carte.

**Avancement 2026-11-18 :** le pipeline typé est utilisé par la résolution des sorts permanents. Un adaptateur explicite compile deux modèles Oracle auto-référentiels exacts : « {nom} enters the battlefield tapped. » et « {nom} enters the battlefield with N +1/+1 counters on it. » ; les modifications sont appliquées avant la création de l’événement. Le moteur et `GameRoom` savent maintenant suspendre une résolution de permanent, conserver une session sérialisable, exposer les candidats uniquement au contrôleur du permanent entrant et reprendre après un ou plusieurs choix. Le checkpoint/journal de commandes permet le rejeu et la restauration, à condition de réinjecter le même résolveur serveur d'effets. Cette tranche reste limitée à un événement/permanent et à un seul joueur décideur ; les effets globaux concrets, choix APNAP simultanés, événements imbriqués et choix 614.12 complets restent à implémenter.

## ETB-0 — Contrat d'événement et changements de zone (fondation obligatoire)
- [ ] Centraliser chaque changement de zone dans un processeur métier (la résolution des sorts permanents utilise maintenant le pipeline proposition → remplacements → commit ; le registre d'effets et les autres chemins restent à migrer).
- [x] Introduire un groupe de simultanéité et des événements commis pour les déplacements batchés indépendants.
- [x] Modéliser explicitement les événements proposés et leur pipeline de remplacement avant commit.
- [x] Respecter les catégories 616.1a-e, réévaluer après chaque remplacement et ne pas appliquer deux fois le même effet au même événement (614.5).
- [x] Suspendre l'évaluation lorsqu'un choix entre plusieurs remplacements concurrents est requis, avec garde de révision pour rejeter les décisions périmées.
- [x] Une prévention annule le commit et ne produit pas d'événement de changement de zone.
- [x] Conserver identité avant/après, owner/controller, cause, trace des remplacements et informations connues dans ZoneChangeEvent.
- [x] Brancher au serveur un registre dérivé de la définition Scryfall pour les modèles self « enters tapped » et « enters with N +1/+1 counters » (allowlist exacte, sans parseur Oracle général).
- [x] Gérer un choix de remplacement en attente dans le protocole serveur pour la résolution d'un permanent : session et candidats sérialisés dans GameState, commande `resolve-zone-change-replacement`, contrôle du joueur décideur, exposition privée dans GameView, suspension de la pile et rejeu/restauration via journal (un seul permanent/décideur ; résolveur d'effets réinjecté par le serveur).
- [ ] Brancher les effets concrets et choix pré-entrée (614.12), événements imbriqués (614.13, 616.1f-g) et caractéristiques d'entrée ; distinguer entrée modifiée d'un trigger (603.6d).
- [x] Tests : mouvements simultanés, groupe partagé, snapshots pré-événement, no-op et requêtes dupliquées.
- [x] Test du wrapper single-move : snapshot avant/après, transfert de contrôleur et état source immuable.
- [x] Tests : entrée engagée et compteurs +1/+1 appliqués avant snapshot `instanceAfter` de l’événement.
- [ ] Tests : événement remplacé, token et nouvelle identité.

## ETB-1 — Détection générique (toutes sources pertinentes)
- [x] Prototype de compilation allowlist exacte pour « When {name} enters », « Whenever [another] creature enters » et « Whenever [another] permanent enters », avec pioche d'une carte ou gain de N points de vie.
- [x] Scanner chaque permanent du battlefield, entrants compris, pour un événement d'entrée commis ; ignorer les scopes « another » lorsque la source est l'entrant.
- [x] Capturer le contrôleur de chaque source au moment du scan et produire des candidats déterministes liés à l'événement.
- [ ] Étendre le scan aux zones de fonctionnement hors battlefield (113.6), aux types/capacités résultant des effets continus (603.6b) et aux capacités non-normal/multi-face.
- [ ] Conditions simples et occurrences multiples.
- [ ] Tests : source elle-même, autre permanent, plusieurs entrants, types modifiés par effets continus.

## ETB-2 — Timing, priorité et APNAP (checkpoint CR 117.5)
- [ ] Accumuler les candidats jusqu'au prochain checkpoint de priorité.
- [ ] SBA avant priorité et collecte des triggers qui en résultent ; répéter jusqu'à stabilisation.
- [ ] Ordre APNAP et ordre choisi par chaque joueur ; deux groupes de 603.3b.
- [ ] Répéter SBA → triggers jusqu'à stabilisation.
- [ ] Tests à 2/4 joueurs, plusieurs contrôleurs, plusieurs triggers par joueur et SBA induites.

## ETB-3 — Conditions, choix, modes et cibles
- [ ] Intervening-if vérifié au trigger et à la résolution.
- [ ] Modes choisis au placement sur la pile.
- [ ] Cibles légales, choix obligatoires/facultatifs et aucune cible légale.
- [ ] « You may » empilé même si le contrôleur refuse ensuite.
- [ ] Tests de cibles illégales, choix impossibles et résolution partielle.

## ETB-4 — Entrées modifiées et caractéristiques
- [ ] « Enters tapped/with counters/as a copy/as [type] » via effets statiques/remplacements, pas faux trigger.
- [ ] Appliquer 614.12/616.1 et choix pré-entrée.
- [ ] Recalculer couches/caractéristiques ; déterminer capacités présentes au moment pertinent.
- [ ] Tests d'effets globaux, auto-remplacements et interactions.

## ETB-5 — Références, identité d'objet et familles avancées
- [ ] Last known information, exceptions de 400.7 et références après changement de zone.
- [ ] Source quittant le battlefield avant résolution.
- [ ] Tokens, copies, multi-faces, face-down, meld, blink, réanimation et entrées simultanées.
- [ ] Capacités retardées/réflexives et capacités liées.

## ETB-6 — Compilation Oracle et corpus
- [ ] Remplacer les motifs exacts actuels par un compilateur Oracle partagé et une IR typée.
- [ ] Corpus Scryfall par motif grammatical, incluant multi-faces/layouts.
- [ ] Mesurer parse, semantic et execution coverage séparément.
- [ ] Tests différentiels et scénarios déterministes/rejouables.
- [ ] Exception carte-spécifique uniquement avec justification, test et règle CR.

## ETB-7 — Couverture des cartes et robustesse en continu
- [ ] Générer des fixtures à partir des cartes Scryfall/Oracle, groupées par motif de trigger et d'effet.
- [ ] Détecter les formulations inconnues et produire un diagnostic stable (règles candidates, token non reconnu, raison d'échec).
- [ ] Mesurer les cartes totalement supportées, partiellement supportées et non supportées ; ne jamais afficher une carte « jouable » si une capacité obligatoire est ignorée.
- [ ] Ajouter des tests différentiels pour les régressions de parseur et des tests de propriété pour les événements simultanés/replacements.

## Critères de sortie
- Sous-aspects pertinents de 603.6, 603.2–603.5, 603.3a–d, 603.7, 603.10–603.12 et règles adjacentes reliés à des tests.
- Aucun trigger supporté perdu ou résolu au mauvais moment dans scénarios simultanés/APNAP.
- Les textes non compilés sont explicitement non supportés, jamais ignorés silencieusement.
- Rejeu, persistance, confidentialité et scénarios à quatre sièges couverts.


## Caractéristiques d'entrée — frontière 614.12 (2026-11-17)

- Nouveau contrat typé `EnteringPermanentCharacteristicsContext` : caractéristiques face-spécifiques du permanent entrant, contrôleur de destination, modifications d'entrée déjà sélectionnées et inventaire complet des permanents actuellement sur le champ de bataille.
- Le constructeur vérifie la révision de partie, la destination battlefield, l'identité de l'entrant, l'unicité et l'exhaustivité des sources battlefield ; les tableaux de caractéristiques sont copiés défensivement.
- Les caractéristiques sont fournies par la couche card-data après sélection de face/layout ; aucune interprétation du texte Oracle ni application des couches n'est effectuée ici.
- Cette tranche fournit le contrat d'entrée à un futur évaluateur 614.12 ; elle ne calcule pas encore les effets continus propres à l'entrant ou provenant d'autres permanents.


## Couche 4 — effets de changement de types (2026-11-17)

- Ajout de Layer4TypeChangingEffect : source explicite, timestamp, sélecteur structuré (contrôleur, types/sous-types/super-types présents) et opération d'ajout/retrait.
- evaluateEnteringPermanentLayer4 applique les effets fournis à l'entrant seulement, en ordre timestamp, en réévaluant chaque sélecteur sur les caractéristiques résultantes ; source possible : entrant lui-même ou permanent déjà présent.
- Le résultat est une copie indépendante et expose les identifiants appliqués.
- Limites : pas de compilation Oracle, pas de dépendances 613.7 ni de couches 1–3/5–7 ; les effets fournis doivent déjà être applicables et ordonnés par le résolveur de règles.

- Précision d'ordre : timestamp croissant ; les égalités conservent l'ordre pré-résolu fourni par l'appelant. Les listes d'ajout sont dédupliquées et les sélecteurs explicitement vides sont rejetés.


## Reprise des sessions de remplacement — moteur (2026-11-18)

- Ajout de `resumeZoneChangeWithReplacements(state, session, effects, context, selectedEffectId?)` : la session de proposition est conservée entre les décisions, puis réévaluée avec la garde de révision existante.
- `processZoneChangeWithReplacements` crée la session initiale et délègue à cette API ; les deux chemins partagent désormais la même logique d'évaluation/commit.
- Un choix successif peut être demandé après l'application du choix précédent ; chaque réponse doit reprendre la session retournée la plus récente.
- Le test vérifie deux checkpoints de choix, la non-mutation avant commit, l'ordre de trace et l'application des marqueurs avant le snapshot d'entrée.
- Hors périmètre : transport/persistance GameRoom, authentification du joueur qui choisit, expiration/reprise après redémarrage, choix APNAP simultanés et effets imbriqués 616.1g.


## Suspension serveur d'une résolution permanente — choix de remplacement (2026-11-18)

- `GameState.pendingZoneChangeChoice` conserve un identifiant déterministe, le joueur décideur, le stack item, la carte source, l'événement proposé, la session de remplacement et les seuls IDs de candidats.
- `GameRoom` traite les permanents avant le chemin de résolution synchrone : si le moteur demande un choix, le sort reste au sommet de la pile, `awaitingResolutionId` reste actif et la carte reste en zone stack ; aucun commit ni trigger ETB n'est émis avant la décision finale.
- La commande `resolve-zone-change-replacement` vérifie le joueur décideur, le pending ID, l'ID candidat et la révision attendue. Les décisions successives mettent à jour la révision de session.
- `GameView` ne révèle l'identifiant de décision et les candidats qu'au joueur autorisé ; les autres sièges ne voient que le compteur.
- Les sessions sont incluses dans le snapshot de partie et le journal accepté permet le rejeu/restauration ; les closures d'effets ne sont jamais sérialisées et sont reconstruites via le résolveur serveur.
- Limites explicites : la première implémentation couvre un permanent entrant et un décideur (contrôleur du permanent) ; elle ne réalise pas le choix APNAP simultané de plusieurs joueurs, 616.1g, ni l'énumération réelle de remplacements de permanents globaux. Les effets supplémentaires sont fournis par le registre injectable `EntryReplacementResolver`.


- Précision CR 608.3e (2026-11-18) : lorsqu'un sort permanent ne peut pas entrer sur le champ de bataille, sa carte est déplacée au cimetière de son propriétaire ; ce chemin ne doit jamais laisser la carte en zone `stack`. Le serveur crée un événement de zone distinct pour cette destination de repli. Le remplacement éventuel de ce second événement reste hors de la portée de cette tranche (événements imbriqués/616.1g).


## ETB-1 — premier scanner de candidats (2026-11-18)

- `scanBasicZoneChangeTriggers` parcourt les permanents du battlefield à partir de l'état commis et examine les lignes Oracle des définitions Scryfall normales.
- Motifs stricts pris en charge : `When {name} enters the battlefield, draw a card.`, `Whenever [another] creature enters the battlefield, draw a card.`, `Whenever [another] permanent enters the battlefield, draw a card.` et leurs variantes `you gain N life.`
- Le scope `another` exclut l'instance source lorsqu'elle est l'entrant ; les triggers non-self sont aussi détectés depuis des permanents déjà présents.
- Chaque candidat capture `controllerAtTrigger`, `sourceInstanceId`, `eventId` et l'index de ligne Oracle ; son ID de StackItem est déterministe.
- Cette tranche ne place pas encore le batch sur la pile : elle retourne des candidats. APNAP/ordre choisi, intégration au checkpoint de priorité, événements simultanés multi-entrants, types/abilities modifiés par couches et sources hors battlefield restent à faire. Le chemin live historique du self-ETB n'est pas encore remplacé par ce scanner.
