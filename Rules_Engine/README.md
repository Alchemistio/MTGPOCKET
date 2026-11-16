# Rules_Engine

Base de connaissance machine-searchable des **Magic: The Gathering Comprehensive Rules**.

## Source importée

`source/MagicCompRules_20260925.txt` est une version texte normalisée de l'édition du 25 septembre 2026 fournie dans le projet. Les séparateurs de lignes sont normalisés en UTF-8/LF pour rendre les positions déterministes.

- PDF officiel : https://media.wizards.com/2026/downloads/MagicCompRules%2020260925.pdf
- Miroir texte utilisé pour la conversion : https://github.com/muz/mtgrulediff/blob/main/rules/MagicCompRules%2020260925.txt

Le texte des règles appartient à Wizards of the Coast et aux ayants droit cités dans la publication. Vérifier les droits de redistribution avant toute diffusion publique du dépôt.

## Recherche

1. Chercher d'abord dans `index/rules_index.md` puis le fichier JSONL du chapitre.
2. Lire le paragraphe complet aux lignes indiquées dans la source.
3. Ouvrir les règles référencées et le glossaire avant de concevoir une transition.
4. Pour une mécanique complexe, créer une fiche dans `memory/rules/<module>/` avec recherche, règles, modèle de données, pipeline, cas limites, tests et roadmap.

## Version

Au 16 novembre 2026, Wizards a publié une édition plus récente, effective au **6 novembre 2026**. L'index local reste aligné sur le PDF fourni et est explicitement non-current. Voir [CURRENT_VERSION.md](CURRENT_VERSION.md).

## Structure
- `source/` : texte normatif importé.
- `index/` : index JSONL exhaustifs et manifest.
- `tools/` : générateur déterministe.
