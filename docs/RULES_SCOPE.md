# Périmètre de conformité des règles

## Référence normative
La référence de travail du projet est le PDF Comprehensive Rules fourni avec le projet, édition du 25 septembre 2026. Les numéros de règles sont consignés dans les tests et cette matrice ; le texte intégral du PDF n'est pas recopié dans le dépôt. Les règles de format Commander sont suivies séparément des Comprehensive Rules.

## Couverture actuellement implémentée
- **CR 103.4c** : total de départ Commander à 40 points de vie.
- **CR 103.5 / 103.5c / 800.6** : déclarations de mulligan par ronde, mulligan de Londres, premier mulligan multijoueur gratuit pour le calcul des cartes à remettre sous la bibliothèque, et remise des cartes choisies dans l’ordre du joueur.
- **CR 104.3b / 704.5a** : perte liée à un total de vie inférieur ou égal à zéro, appliquée au checkpoint de state-based actions.
- **CR 104.3c / 704.5b** : suivi d'une tentative de pioche dans une bibliothèque vide et perte au checkpoint de state-based actions.
- **CR 104.3j / 704.6c** : cumul des blessures de combat par instance de commandant et perte à 21.
- **CR 800.4a** : retrait des objets possédés par un joueur qui quitte la partie ; exil des permanents/cartes encore contrôlés par ce joueur et possédés par un autre ; retrait des objets de pile contrôlés par ce joueur.
- **CR 800.4a / 800.4j** : transfert de priorité après le départ d'un joueur et poursuite du tour sans joueur actif si le joueur actif quitte la partie.
- **CR 903.8 / 903.10** : suivi de la taxe de commandant par commandant et des blessures par commandant (la taxe est calculée à +{2} par lancement antérieur).

Cette couverture est partielle : les effets de contrôle continus, les choix de remplacement liés au départ d'un joueur, les objets non-cartes complexes et les actions basées sur l'état autres que les pertes listées restent à implémenter.

## À implémenter ensuite
1. **CR 103.5 / 103.5c / 800.6** : mulligan de Londres en multijoueur, premier mulligan gratuit pour le nombre de cartes à remettre sous la bibliothèque, déclarations simultanées et verrouillage des mains gardées.
2. **CR 704** : autres actions basées sur un état (créatures, auras, légende, planeswalkers, jetons, etc.).
3. **CR 117** : gestion complète des fenêtres de priorité, actions spéciales, déclenchements et résolution de pile.
4. **CR 500–514** : automatisation des actions obligatoires de chaque étape, fenêtres conditionnelles et nettoyage.
5. **CR 800.4** : effets continus, choix et cas particuliers lors du départ d'un joueur.

## Processus de développement
Référence → modèle de données → commande/transition → tests positifs → tests négatifs → documentation. Distinguer règle générale et règle de format, capacité oracle et effet réellement implémenté. Ne jamais exécuter du texte de carte arbitraire.

Le moteur ne doit jamais annoncer une conformité complète sans matrice de couverture et tests correspondants. Les limites doivent remonter à l'interface afin qu'une intervention humaine soit possible.

## Données et propriété intellectuelle
Respecter les conditions des fournisseurs, limites de débit et droits des ayants droit. Conserver identifiants et provenance. Ne pas committer de dumps ou images sans autorisation.
