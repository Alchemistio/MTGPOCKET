# Rules_Engine

Base de connaissance consultable des **Magic: The Gathering Comprehensive Rules**. Cette base est un outil de recherche et de traçabilité pour le moteur Commander Pocket ; le texte de Wizards reste l'autorité normative.

## Sources importées

- **Version courante :** [MagicCompRules_20261106.txt](source/MagicCompRules_20261106.txt), règles effectives au 6 novembre 2026.
- **Archive :** [MagicCompRules_20260925.txt](source/MagicCompRules_20260925.txt), édition correspondant au PDF fourni dans le projet.
- **Page officielle Wizards :** https://magic.wizards.com/en/rules
- **PDF officiel courant :** https://media.wizards.com/2026/downloads/MagicCompRules%2020261106.pdf
- **Miroir texte utilisé pour la version normalisée :** https://github.com/muz/mtgrulediff/blob/main/rules/MagicCompRules%2020261106.txt

Le texte des Comprehensive Rules appartient à Wizards of the Coast et aux ayants droit cités dans la publication. Vérifier les droits de redistribution avant toute diffusion publique du dépôt. Le miroir texte est une commodité de recherche ; en cas d'écart, le PDF officiel prévaut.

## Recherche

1. Chercher l'identifiant ou les mots-clés dans [l'index maître](index/rules_index.md).
2. Ouvrir l'entrée JSONL du chapitre correspondant et relever `line_start` / `line_end`.
3. Lire le paragraphe complet dans le fichier source de la même édition.
4. Suivre les règles référencées et les termes du [glossaire indexé](index/glossary_index.jsonl).
5. Pour une mécanique complexe, créer/mettre à jour sa fiche sous `memory/rules/<module>/` : recherche, règles, modèle, pipeline, cas limites, roadmap et tests.

Les résumés et mots-clés sont des aides de navigation générées automatiquement, pas des interprétations normatives. Toujours relire le paragraphe source et ses renvois.

## Génération

```bash
python Rules_Engine/tools/build_rule_index.py
```

Le générateur utilise uniquement la bibliothèque standard Python. Il reconstruit les index JSONL, le glossaire, le manifest et l'index Markdown à partir du fichier source courant. Les positions sont des numéros de lignes inclusifs, stables pour ce fichier texte.

## Couverture de l'édition 2026-11-06

- 3 182 règles et sous-règles numérotées.
- 148 en-têtes de chapitre/section.
- 744 entrées de glossaire.
- 9 fichiers d'index de chapitre + un index de glossaire.

Voir [manifest](index/index_manifest.json) et [versionnement](CURRENT_VERSION.md).
