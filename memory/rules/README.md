# Mémoire des règles — index des modules

## Références
- Index normatif : `Rules_Engine/index/rules_index.md`.
- Glossaire : `Rules_Engine/index/glossary_index.jsonl`.
- Groupes : `Rules_Engine/index/sections_index.jsonl`.
- Stratégie : `docs/RULE_ENGINE_STRATEGY.md`.

## Modules
- [ETB / zone-change triggers](etb/etb_index.md) — entrée sur le champ de bataille, détection, APNAP, pile, choix, résolution, remplacements et couches.
- [Architecture générale](engine_architecture.md) — compilation Oracle, IR d'effets, moteur déterministe et événements.

## Principe
Implémenter une mécanique générique pour une famille de cartes, pas une carte isolée. Une exception par carte n'est admise que si le texte ou la mécanique ne peut raisonnablement être exprimé dans le modèle générique ; elle doit être isolée, documentée et testée.
