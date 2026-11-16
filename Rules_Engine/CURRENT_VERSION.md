# Version des règles — état de synchronisation

Dernière vérification : **16 novembre 2026**.

## Source locale indexée
- Édition : 25 septembre 2026, fournie dans le projet.
- Index : 3 166 règles/sous-règles, 741 entrées de glossaire.
- État : source et index alignés entre eux, mais **pas la dernière édition officielle**.

## Dernière édition officielle connue
Wizards a publié les Comprehensive Rules effectives au **6 novembre 2026** :
- PDF officiel : https://media.wizards.com/2026/downloads/MagicCompRules%2020261106.pdf
- Page officielle : https://magic.wizards.com/en/rules
- Rapport de différences 25 septembre → 6 novembre : https://muz.github.io/mtgrulediff/releases/20260925_to_20261106.html

Le tracker rapporte 28 règles ajoutées, 11 retirées, 34 modifiées et 237 renumérotées. Il faut reconstruire identifiants, positions, références et tests ; une simple mise à jour de date ne suffit pas.

## Procédure de mise à jour
1. Obtenir le PDF ou texte de la nouvelle édition dans le contexte du projet.
2. Archiver l'ancienne source et son manifest.
3. Normaliser uniquement encodage et séparateurs ; ne pas réécrire le texte normatif.
4. Exécuter le générateur et vérifier doublons, règles manquantes et positions.
5. Générer un diff d'identifiants/contenu et examiner les renumérotations.
6. Mettre à jour les fiches mémoire, tests et roadmap impactés.

Ne jamais présenter l'index du 25 septembre comme l'édition courante.
