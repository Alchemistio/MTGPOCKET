# Index maître — Comprehensive Rules 2026-11-06

Cet index couvre **tous les paragraphes de règles et sous-règles détectés**, ainsi que tous les titres de chapitre/section. Chaque entrée JSONL comprend un résumé thématique, des mots-clés et une position inclusive dans le fichier source courant.

| Chapitre | Index JSONL | Entrées |
|---|---|---:|
| 1. Game Concepts | [rules_chapter_1.jsonl](rules_chapter_1.jsonl) | 531 |
| 2. Parts of a Card | [rules_chapter_2.jsonl](rules_chapter_2.jsonl) | 135 |
| 3. Card Types | [rules_chapter_3.jsonl](rules_chapter_3.jsonl) | 181 |
| 4. Zones | [rules_chapter_4.jsonl](rules_chapter_4.jsonl) | 88 |
| 5. Turn Structure | [rules_chapter_5.jsonl](rules_chapter_5.jsonl) | 166 |
| 6. Spells, Abilities, and Effects | [rules_chapter_6.jsonl](rules_chapter_6.jsonl) | 337 |
| 7. Additional Rules | [rules_chapter_7.jsonl](rules_chapter_7.jsonl) | 1 578 |
| 8. Multiplayer Rules | [rules_chapter_8.jsonl](rules_chapter_8.jsonl) | 184 |
| 9. Casual Variants | [rules_chapter_9.jsonl](rules_chapter_9.jsonl) | 139 |

- [Glossary index — 744 terms](glossary_index.jsonl)
- [Manifest and counts](index_manifest.json)
- [Source 2026-11-06](../source/MagicCompRules_20261106.txt)
- [Archived source 2026-09-25](../source/MagicCompRules_20260925.txt)
- [Rebuild script](../tools/build_rule_index.py)

## Coverage

- **3 182** règles/sous-règles numérotées.
- **148** en-têtes de chapitre/section.
- **744** entrées du glossaire.
- Chaque règle/sous-règle est une entrée distincte ; les en-têtes et le glossaire ont leurs propres entrées.

## Schéma JSONL

`id`, `kind`, `summary`, `keywords`, `chapter`, `chapter_title`, `section_id`, `section_title`, `source_file`, `line_start`, `line_end`, et `related_rules` pour les règles.

Les résumés et mots-clés sont des aides de recherche automatiques. Ils ne remplacent jamais le texte normatif. Lire la source et les règles référencées avant d'implémenter un comportement.
