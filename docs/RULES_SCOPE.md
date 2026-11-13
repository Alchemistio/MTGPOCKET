# Périmètre de conformité des règles

## Référence
Le document Comprehensive Rules fourni dans le projet (édition du 25 septembre 2026) est la référence de travail. Pour chaque règle codée, consigner son numéro et ses dépendances dans les tests/docs. Le PDF n'est pas recopié dans le dépôt. Les règles Commander de format sont suivies séparément et versionnées.

## Processus
Référence → modèle de données → commande/transition → tests positifs → tests négatifs → documentation. Distinguer règle générale et règle de format, capacité oracle et effet réellement implémenté. Ne jamais exécuter du texte de carte arbitraire.

## Paliers
1. Fondation : joueurs, tours, étapes, zones, priorité, pile abstraite.
2. Jeu : actions, coûts, cibles, capacités, combat.
3. Règles avancées : couches, remplacement/prévention, copies, choix, interactions.
4. Cartes : catalogue d'effets implémentés, chacun couvert par scénarios.

Le moteur ne doit pas annoncer une conformité complète sans matrice de couverture et tests correspondants. Les limites doivent remonter à l'interface afin qu'une intervention humaine soit possible.

## Données et propriété intellectuelle
Respecter les conditions des fournisseurs, limites de débit et droits des ayants droit. Conserver identifiants et provenance. Ne pas committer de dumps ou images sans autorisation.
