# Workflow de développement — Commander Pocket

> Procédure opératoire pour chaque session de travail. Objectif : avancer jusqu'à épuisement des actions sûres et utiles, pas jusqu'à la prochaine notification CI.

## 0. Reprise obligatoire

1. Lire [RESUME.md](RESUME.md) en premier.
2. Lire [PROJECT_INDEX.md](PROJECT_INDEX.md), [ROADMAP.md](ROADMAP.md), [PROJECT_LOG.md](PROJECT_LOG.md) et les issues concernées.
3. Vérifier l'état réel GitHub : branche, HEAD, PR, derniers commits, CI et éventuels changements externes.
4. Lire les fichiers réellement concernés à partir du HEAD courant. Ne jamais se fier à un ancien extrait, un ancien SHA ou à une supposition.
5. Identifier le prochain objectif utile, ses dépendances, les critères de sortie et les blocages.

## 1. Synchronisation et sécurité Git

Avant toute écriture :
- Récupérer le HEAD de `feat/commander-pocket-foundation` et son tree SHA.
- Lire les versions exactes des fichiers concernés depuis ce HEAD.
- Construire les changements sur le dernier tree avec `base_tree`.
- Créer le commit avec le HEAD courant comme parent.
- Mettre à jour la branche avec `expected_sha` égal au HEAD lu et `force=false`.
- Si la branche a bougé, arrêter l'écriture, récupérer le nouvel état et réconcilier. Ne jamais écraser un travail externe.
- Vérifier ensuite le nouveau HEAD et le head SHA de la PR.

Règles permanentes :
- PR #1 reste en brouillon. Aucun merge sans demande explicite.
- Aucun secret, dump volumineux ou snapshot de données ne doit être commité par défaut.
- Les données de légalité Commander ne sont jamais inventées : vérifier et dater les sources officielles.
- Respecter les vues privées : jamais de GameState brut ni de main adverse dans une vue client.
- Respecter le schéma Scryfall, les cartes multi-face et RuntimeCardState.
- Garder l'UX mobile compacte, paysage et accessible.

## 2. Boucle d'exécution — ne pas attendre passivement la CI

Pour chaque tranche :
1. Choisir une tranche cohérente et réalisable. Découper les gros objectifs en étapes vérifiables.
2. Inspecter contrats, types, appels, consommateurs, erreurs et tests existants avant de modifier.
3. Implémenter le changement complet, pas seulement le chemin heureux.
4. Ajouter/adapter les tests : cas nominal, limites, entrées invalides, sécurité/confidentialité et régression.
5. Examiner les effets transverses : serveur, moteur, protocole, mobile, données, migrations et documentation selon le périmètre.
6. Relire le diff complet. Vérifier les fichiers modifiés, les oublis, les hypothèses et les comportements non couverts.
7. Exécuter les vérifications locales réellement disponibles. Si le workspace local ou une dépendance manque, le noter clairement et ne pas prétendre avoir exécuté ces tests.
8. Mettre à jour les documents concernés : RESUME, PROJECT_LOG, index, roadmap, matrice de tests ou ADR si nécessaire.
9. Committer une tranche cohérente et déclencher/observer la CI.
10. **Avant d'attendre un nouveau résultat CI, faire obligatoirement le contrôle “reste-t-il du travail possible ?” ci-dessous.**

### Contrôle obligatoire avant toute attente CI

Ne pas s'arrêter à « CI en cours ». Vérifier explicitement :

- [ ] Le diff du commit est relu et cohérent.
- [ ] Les tests pertinents sont ajoutés pour les nouveaux comportements et les erreurs.
- [ ] Les contrats et consommateurs liés ont été inspectés.
- [ ] Les contrôles sécurité, confidentialité, autorité serveur et validation des entrées sont faits.
- [ ] Les dépendances documentaires et sources normatives ont été vérifiées quand le changement en dépend.
- [ ] Les mises à jour de documentation, reprise, journal, roadmap et matrice de tests sont faites.
- [ ] Les tâches indépendantes suivantes ont été recherchées dans la roadmap et les issues.
- [ ] Les tâches réalisables sans connaître le résultat CI ont été avancées ou explicitement écartées avec une raison.
- [ ] Les blocages restants sont nommés : résultat CI indispensable, source externe non vérifiable, secret/permission absent, décision utilisateur, appareil physique ou matériel indisponible.

Si une action sûre et utile reste faisable sans le résultat CI, **continuer cette action**. Il est permis de préparer et committer une autre tranche indépendante pendant que la CI tourne, après resynchronisation du HEAD. Ne pas empiler des changements dépendants d'un résultat encore inconnu. Si une CI échoue, corriger d'abord la cause avant de poursuivre les changements qui en dépendent.

L'attente CI n'est justifiée que lorsqu'il ne reste aucune action indépendante utile à effectuer, ou lorsqu'un résultat CI est une dépendance réelle pour choisir la suite. Même dans ce cas, utiliser l'attente pour inspecter les logs, les checks, les tâches non bloquées et préparer la correction probable — pas pour annoncer prématurément que le travail est terminé.

## 3. Traitement de la CI

1. Trouver le run lié au commit exact et confirmer son `head_sha`.
2. Examiner tous les jobs et leurs étapes, pas seulement le badge global.
3. En cas d'échec, lire les logs du job, identifier la cause racine, corriger, ajouter un test de non-régression et pousser un nouveau commit.
4. Relancer la boucle « reste-t-il du travail possible ? » avant d'attendre le run suivant.
5. En cas de succès, noter le SHA exact, le run, les jobs et les contrôles réellement passés.
6. Si des commits de documentation avancent ensuite le HEAD, distinguer le HEAD documentaire du dernier commit de code couvert par CI. Vérifier qu'aucun code non testé n'a été ajouté après le commit vert.
7. Ne jamais confondre CI verte, intégration multi-clients, validation simulateur et test sur appareils physiques.

La CI actuelle du dépôt exécute :
- `pnpm install --no-frozen-lockfile`
- `pnpm typecheck`
- `pnpm test`
- `python -m pip install -r scripts/requirements.txt`
- `python -m unittest discover -s scripts -p "test_*.py"`

Source de vérité : [../.github/workflows/ci.yml](../.github/workflows/ci.yml). Vérifier ce fichier si les jobs changent.

## 4. Définition de “terminé” pour une session

Une session de développement n'est terminée que lorsque :
- l'objectif demandé est livré ou impossible à poursuivre sans une dépendance externe clairement identifiée ;
- toutes les étapes sûres et indépendantes disponibles ont été examinées et réalisées ;
- la CI pertinente est verte sur le commit de code exact, ou son état/échec est explicitement signalé si le service CI est indisponible ;
- les documents de reprise et le journal reflètent l'état réel ;
- le HEAD et la PR sont revérifiés ;
- les limites non testées sont écrites sans ambiguïté.

Ne pas arrêter simplement parce qu'un commit a été poussé, parce que la CI a démarré ou parce qu'une première tranche est terminée. Continuer sur la prochaine tâche réalisable tant qu'il reste du travail utile dans le périmètre.

Le projet entier n'est pas déclaré terminé tant que les critères de sortie de la roadmap ne sont pas atteints. Les tests sur appareils, le test à quatre clients, les règles non implémentées et les données officielles non provisionnées restent des blocages réels ; ils ne peuvent pas être remplacés par une CI verte.

## 5. Compte rendu de fin de session

Rapporter brièvement :
- changements livrés et commits ;
- CI : run + SHA + jobs/conclusion ;
- tests réellement exécutés hors CI ;
- tâches indépendantes terminées ;
- blocages restants et pourquoi ils ne peuvent pas être levés maintenant ;
- prochain pas concret.

Toujours dire ce qui n'a pas été testé. Ne jamais prétendre qu'une action, un téléchargement, un test appareil ou une intégration réelle a réussi sans preuve.
