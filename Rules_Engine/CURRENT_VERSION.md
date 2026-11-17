# Version des règles — état de synchronisation

Dernière vérification : **16 novembre 2026**.

## Version courante importée

- Édition : **6 novembre 2026**.
- Source : `Rules_Engine/source/MagicCompRules_20261106.txt`.
- Index : 3 182 règles/sous-règles, 148 en-têtes de chapitre/section et 744 termes de glossaire.
- État : source texte et index alignés sur l'édition officielle effective au 6 novembre 2026.
- Manifest : [index_manifest.json](index/index_manifest.json).

## Archive

- Édition : 25 septembre 2026, correspondant au PDF fourni dans le projet.
- Source : `Rules_Engine/source/MagicCompRules_20260925.txt`.
- Cette archive n'est pas utilisée comme base courante de recherche sauf pour une comparaison historique.

## Sources et vérification

- Page officielle Wizards : https://magic.wizards.com/en/rules
- PDF officiel 2026-11-06 : https://media.wizards.com/2026/downloads/MagicCompRules%2020261106.pdf
- Texte normalisé consulté : https://github.com/muz/mtgrulediff/blob/main/rules/MagicCompRules%2020261106.txt
- Diff 2026-09-25 → 2026-11-06 : https://muz.github.io/mtgrulediff/releases/20260925_to_20261106.html

Le tracker de différences rapporte 28 règles ajoutées, 11 retirées, 34 modifiées et 237 renumérotées. Les identifiants, références et positions ont donc été reconstruits plutôt que simplement renommés. Notre extraction détecte 3 182 paragraphes numérotés de règles/sous-règles, tous indexés avec identifiants uniques ; les 148 titres de chapitre/section sont indexés séparément. Le tracker public affiche 3 183 « rules » : son décompte diffère d'une unité de notre décompte des paragraphes, sans qu'un paragraphe numéroté non indexé ait été trouvé dans la source.

## Procédure de mise à jour

1. Obtenir le nouveau PDF ou texte depuis la page officielle Wizards.
2. Archiver la source et le manifest précédents.
3. Normaliser uniquement l'encodage et les séparateurs de lignes ; ne pas réécrire le texte normatif.
4. Exécuter `python Rules_Engine/tools/build_rule_index.py`.
5. Vérifier les nombres de règles, sous-règles, titres et termes du glossaire, les doublons et les positions.
6. Générer un diff des identifiants/contenus et examiner les renumérotations.
7. Mettre à jour les fiches mémoire, tests et roadmaps impactés.

En cas de divergence, le PDF publié par Wizards prime sur le miroir texte, les résumés et l'index.
