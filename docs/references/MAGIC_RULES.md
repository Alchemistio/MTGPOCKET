# Référence locale — règles Magic et Commander

- **Référence de travail fournie au projet :** Comprehensive Rules, édition du 25 septembre 2026, PDF de 312 pages.
- **Vérification locale du PDF :** 2026-11-13.
- **Matrice de couverture du code :** [../RULES_SCOPE.md](../RULES_SCOPE.md).

## Repères vérifiés dans l'édition fournie

- CR 103.4c : total de départ de 40 points de vie en Commander.
- CR 103.5 : déclarations de mulligan dans l'ordre du tour, mulligans simultanés après les déclarations, remise sous la bibliothèque après chaque mulligan.
- CR 103.5c et 800.6 : en multijoueur, le premier mulligan ne compte pas pour le nombre de cartes à remettre ni pour le nombre de mulligans permis.
- CR 104.3j et 704.6c : perte à 21 blessures de combat ou plus du même commandant.
- CR 704.6d et 903.9a : si le commandant est dans un cimetière ou l'exil et qu'il y est arrivé depuis la dernière vérification des actions basées sur un état, son propriétaire peut le déplacer vers la zone de commandement.
- CR 903.6–903.8 : placement du commandant, mélange, main initiale et taxe de commandant.
- CR 903.9b : effet de remplacement facultatif si un commandant devait être mis dans la main ou la bibliothèque de son propriétaire depuis n'importe où.
- CR 903.10a : suivi des blessures de combat par commandant, séparément pour chacun.

## Règles de travail

- Implémenter les Comprehensive Rules générales et les règles de format Commander séparément.
- Les actions basées sur un état sont vérifiées aux checkpoints prescrits, pas après chaque mutation arbitraire.
- Distinguer les dégâts de combat de tout autre type de dégâts pour le seuil de 21.
- Les deux commandants d'un partenariat gardent chacun leur compteur de dégâts distinct.
- Les choix de remplacement doivent être des décisions du joueur propriétaire au moment approprié, pas des mouvements automatiques.
- Les commandants peuvent changer de zone par d'autres effets ; la règle de retour ne doit pas être codée comme une propriété immuable du type de carte.
- Une capacité ou un texte Oracle ne doit jamais être exécuté comme du code arbitraire.

## Copyright et archivage

Le PDF fourni est une œuvre de Wizards of the Coast. Il n'est pas recopié dans le dépôt. Cette fiche ne contient que des numéros de règles et des notes techniques de travail ; consulter le document fourni pour le texte normatif complet. Les règles de format/banlist peuvent évoluer séparément.
