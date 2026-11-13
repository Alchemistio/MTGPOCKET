# Périmètre de conformité des règles

## Référence normative
La référence de travail est le PDF Comprehensive Rules fourni avec le projet, édition du 25 septembre 2026 (312 pages). Les numéros de règles sont consignés ici ; le texte intégral n'est pas recopié dans le dépôt. Les règles de format Commander et la banlist sont suivies séparément des Comprehensive Rules.

## Couverture actuellement implémentée (à la date du journal)
- **CR 103.4c** : 40 points de vie de départ en Commander.
- **CR 103.5 / 103.5c / 800.6** : mulligan multijoueur de Londres ; premier mulligan non comptabilisé pour les cartes à remettre et le nombre de mulligans ; déclarations dans l'ordre du tour et mulligans simultanés doivent rester couverts par des tests de scénario.
- **CR 104.3j / 704.6c / 903.10a** : perte à 21 blessures de combat ou plus infligées par le même commandant ; suivi séparé par commandant.
- **CR 704.6d / 903.9a** : fenêtre de choix de retour en zone de commandement depuis cimetière/exil après l'événement et avant le prochain checkpoint SBA.
- **CR 903.6–903.8** : placement face visible des commandants, mélange de la bibliothèque restante, 40 PV, main de sept cartes et taxe de +{2} par lancement depuis la zone de commandement.
- **CR 800.4a / 800.4j** : certaines conséquences du départ d'un joueur et continuité de tour/priorité sont couvertes par le moteur de base ; les cas avec effets continus restent incomplets.
- Validation initiale des decks : taille, singleton par nom anglais, identité couleur, légalité et registre de compatibilité des commandants.

**Important :** cette liste décrit le périmètre des tests et du code actuels, pas une certification de conformité. Les règles citées doivent être reliées à des tests précis ; les cas non testés restent « à vérifier ».

## Lacunes critiques avant une partie complète
1. **CR 704.6d / 903.9a** : implémenter le choix facultatif du propriétaire au checkpoint SBA après l'arrivée du commandant au cimetière ou en exil.
2. **CR 903.9b–c** : effet de remplacement facultatif vers la zone de commandement depuis main/bibliothèque et cas de permanents fusionnés/assemblés.
3. **CR 117** : fenêtres de priorité complètes, actions spéciales, déclenchements et résolution de pile.
4. **CR 704** : actions basées sur un état générales et simultanées.
5. **CR 500–514** : actions obligatoires des phases/étapes, combat complet, étapes de nettoyage et fenêtres conditionnelles.
6. **CR 800.4** : départ d'un joueur, objets possédés/contrôlés par d'autres joueurs, effets continus et cas de remplacement.
7. Capacités de cartes : coûts, cibles, choix, couches, copies, remplacement, prévention et effets continus.

## Processus
Référence → modèle de données → commande/transition → test positif → test négatif → test de régression → mise à jour de cette matrice. Distinguer règle générale, règle de format, capacité Oracle et effet réellement implémenté. Ne jamais exécuter du texte Oracle comme du code arbitraire.

## Données et propriété intellectuelle
Respecter les conditions des fournisseurs, les limites de débit et les droits des ayants droit. Conserver identifiants et provenance. Ne pas committer de dumps ou images sans autorisation.
