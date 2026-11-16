# memory_index — index de la mémoire technique

Cette mémoire complète `docs/ROADMAP.md` et conserve recherches, décisions d'architecture et plans de modules. La source normative reste `Rules_Engine/source/` ; la mémoire ne la remplace jamais.

## Base de règles
- [Rules Engine](../Rules_Engine/README.md) — source texte, index exhaustif et outil de reconstruction.
- [Index des règles](../Rules_Engine/index/rules_index.md) — règles, sous-règles, glossaire et positions.
- [Synchronisation des versions](../Rules_Engine/CURRENT_VERSION.md) — source locale 2026-09-25, dernière édition officielle connue 2026-11-06.

## Modules
- [Index des modules](rules/README.md)
- [Architecture générale](rules/engine_architecture.md)
- [ETB — index](rules/etb/etb_index.md)
- [ETB — recherche](rules/etb/etb_research.md)
- [ETB — roadmap](rules/etb/etb_roadmap.md)

## Convention
Pour chaque module complexe : créer `memory/rules/<module>/`, une fiche de recherche, une architecture, une roadmap et un index local. Chaque affirmation normative cite les numéros CR et la version source. Séparer texte CR, recherche/interprétation, décision d'architecture, comportement implémenté et tests.
