# Référence locale — Scrydex

- **Vérifié :** 2026-11-13.
- **Docs :** https://scrydex.com/docs/
- **Cartes :** https://scrydex.com/docs/magicthegathering/cards
- **Authentification :** https://scrydex.com/docs/getting-started/authentication

## Points observés

- Fournisseur de données Magic alternatif, avec API de cartes et recherches paginées.
- L'authentification documentée utilise `X-Api-Key` et `X-Team-ID`.
- Les clés sont des secrets : ne jamais les embarquer dans le bundle mobile, les logs, les fixtures ou les commits.
- Les coûts, crédits, limites, disponibilité, licences et champs doivent être vérifiés dans le contrat de l'équipe avant activation.

## Décision d'intégration

Scrydex n'est pas activé par défaut. Scryfall reste la source runtime principale ; MTGJSON reste l'option bulk. N'ajouter Scrydex qu'après un besoin documenté (par exemple un SLA, un endpoint manquant ou un contrat de données) et des tests de conformité de schéma.
