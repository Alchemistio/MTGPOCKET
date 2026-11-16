# Mémoire des règles — index des modules

## Références
- Index normatif courant : `Rules_Engine/index/rules_index.md` (édition 2026-11-06).
- Glossaire : `Rules_Engine/index/glossary_index.jsonl` (744 termes).
- Groupes : `Rules_Engine/index/sections_index.jsonl`.
- Stratégie : `docs/RULE_ENGINE_STRATEGY.md`.

- Index mémoire et workflow : [rules_index.md](rules_index.md).

## Modules
- [ETB / zone-change triggers](etb/etb_index.md) — entrée sur le champ de bataille, détection, APNAP, pile, choix, résolution, remplacements et couches.
- [Architecture générale](engine_architecture.md) — compilation Oracle, IR d'effets, moteur déterministe et événements.

## Principe
Implémenter une mécanique générique pour une famille de cartes, pas une carte isolée. Une exception par carte n'est admise que si le texte ou la mécanique ne peut raisonnablement être exprimé dans le modèle générique ; elle doit être isolée, documentée et testée.
