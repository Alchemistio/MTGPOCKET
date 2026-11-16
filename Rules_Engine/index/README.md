# Index machine des règles

Édition source : 2026-09-25.

- `rules/` : 9 fichiers JSONL, un par chapitre, couvrant 3 166 règles et sous-règles.
- `glossary_index.jsonl` : 741 termes du glossaire.
- `sections_index.jsonl` : 9 chapitres et 147 groupes de règles.
- `manifest.json` : version, compteurs, fichiers et validations.

Chaque règle contient identifiant, hiérarchie, résumé extractif, mots-clés, références croisées et position `source_location`. Lignes 1-based inclusives ; offsets UTF-8 end-exclusive dans `Rules_Engine/source/MagicCompRules_20260925.txt`. Les résumés servent à retrouver le paragraphe, jamais à remplacer sa lecture.

Reconstruction : `node Rules_Engine/tools/build-index.mjs`.
