# Index mémoire — règles de Magic

Ce dossier est le point d'entrée mémoire pour les travaux de règles. La source normative est dans `Rules_Engine/`; les notes ci-dessous sont de la recherche et des décisions de conception, pas des règles officielles.

## Source et index exhaustif
- [Index maître des Comprehensive Rules 2026-11-06](../../Rules_Engine/index/rules_index.md)
- [Manifest de couverture](../../Rules_Engine/index/index_manifest.json)
- [Versionnement et archives](../../Rules_Engine/CURRENT_VERSION.md)
- [Générateur de l'index](../../Rules_Engine/tools/build_rule_index.py)

## Domaines transverses
- [Architecture cible du moteur](engine_architecture.md) — compilation Oracle, IR, événements, remplacements, SBA, pile et priorité.
- [ETB / zone-change triggers](etb/etb_index.md) — premier module détaillé.
- [Index des modules](README.md) — modules existants et à venir.

## Workflow de recherche
1. Identifier les règles CR candidates dans l'index maître.
2. Lire les paragraphes complets dans la version source référencée.
3. Suivre les références croisées et les termes du glossaire.
4. Compléter avec les publications Wizards et les ressources de juges ; signaler leur statut (normatif ou explicatif).
5. Concevoir un module générique et une roadmap de couverture.
6. Mapper chaque règle → composant → test ; noter les exceptions non couvertes.
7. Ne jamais coder une carte individuellement si sa capacité est exprimable par les primitives génériques.

## Statut
L'index CR couvre 3 182 règles/sous-règles, 148 en-têtes et 744 termes de glossaire pour l'édition du 6 novembre 2026. Les résumés/mots-clés sont des aides de navigation ; le texte Wizards reste l'autorité.
