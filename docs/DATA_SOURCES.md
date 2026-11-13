# Sources de données Magic

État vérifié le 13 novembre 2026. Les fournisseurs sont isolés derrière des adaptateurs ; aucun format fournisseur ne devient le modèle runtime du moteur. Voir les fiches détaillées dans [references](references/README.md).

## Scryfall — source principale
- API HTTPS pour recherche, nom exact/flou et récupération par ID.
- Préserver IDs Scryfall/Oracle, `layout`, `card_faces`, identité couleur, légalité et provenance.
- Scryfall demande un trafic soutenu inférieur à 10 requêtes/seconde, des en-têtes `User-Agent` descriptif et `Accept`, et recommande Bulk Data pour les gros volumes.
- Respecter 429/403 : réduire le trafic et appliquer un backoff ; ne pas faire de retries agressifs.
- Cache actuel : cartes six heures et recherches quinze minutes côté service ; cartes six heures et pages de recherche vingt-quatre heures côté mobile. L'index complet du catalogue reste à construire.
- Références : [API](https://scryfall.com/docs/api), [Bulk Data](https://scryfall.com/docs/api/bulk-data), [FAQ de limitation](https://scryfall.com/docs/faqs/i-m-having-trouble-accessing-the-scryfall-api-or-i-m-blocked).

## MTGJSON — imports bulk
- Source secondaire pour dumps, métadonnées, sets et rapprochements.
- Les snapshots AllPrintings sont volumineux ; téléchargement et transformation dans le pipeline, pas au lancement de l'app.
- Le pipeline initial `scripts/import_mtgjson.py` lit JSON/JSON.GZ, extrait vers SQLite et conserve checksum SHA-256/provenance.
- Ne pas écraser silencieusement les champs Scryfall : conserver la provenance et une politique de priorité.
- Références : [site](https://www.mtgjson.com/), [Getting started](https://www.mtgjson.com/getting-started/), [index v5](https://mtgjson.com/api/v5/).

## magicthegathering.io
La documentation annonce la dépréciation de l'API et un arrêt prévu le 1er mars 2027 avec migration recommandée vers Scrydex. Ne pas créer un nouvel adaptateur de production sans raison de compatibilité legacy. Référence : https://docs.magicthegathering.io/

## Scrydex — fournisseur secondaire éventuel
API de cartes avec authentification documentée via `X-Api-Key` et `X-Team-ID`. Ne jamais embarquer de clé dans l'application mobile ni dans Git. Évaluer prix, crédits, contrat, limites et schéma avant activation. Références : https://scrydex.com/docs/magicthegathering/cards et https://scrydex.com/docs/getting-started/authentication.

## mtgapi.com
Aucun contrat API officiel suffisamment vérifiable n'a été confirmé pendant cette revue. Ne pas intégrer sur la seule base du nom de domaine : demander une version de documentation et vérifier disponibilité, licence, champs, authentification et limites.

## Règles d'intégration
1. Scryfall est la source runtime principale pour recherche et Oracle.
2. MTGJSON sert aux imports bulk et à la résilience hors ligne.
3. Les adaptateurs secondaires ne remplacent jamais IDs/layouts multi-faces sans mapping explicite.
4. Les secrets API restent côté serveur.
5. Chaque import est daté, versionné, contrôlé par checksum et test de schéma.
