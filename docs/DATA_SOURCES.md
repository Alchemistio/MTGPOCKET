# Sources de données Magic

État vérifié le 13 novembre 2026. Les fournisseurs sont isolés derrière des adaptateurs ; aucun format fournisseur ne devient le modèle runtime du moteur.

## Scryfall — source principale
- Utiliser l’API HTTPS pour recherche, nom exact/flou et récupération par ID.
- Conserver les IDs Scryfall et Oracle, `layout`, `card_faces`, identité couleur, légalité et provenance.
- Limite publiée : rester **sous 10 requêtes par seconde**. Le client utilise une cadence de 125 ms, `User-Agent` applicatif et `Accept` JSON.
- Cache mémoire serveur : cartes six heures, recherches quinze minutes. Le cache SQLite mobile conserve les cartes six heures et les pages de recherche vingt-quatre heures pour faciliter la consultation hors ligne ; l’indexation complète du catalogue reste à construire.
- Pour les imports massifs, préférer les fichiers bulk Scryfall plutôt que de boucler sur des requêtes unitaires.

Références :
- https://scryfall.com/docs/api
- https://scryfall.com/docs/faqs/i-m-having-trouble-accessing-the-scryfall-api-or-i-m-blocked

## MTGJSON — import secondaire
- Source secondaire pour les données bulk, métadonnées, sets et rapprochements.
- Les fichiers AllPrintings sont volumineux ; téléchargement et transformation côté pipeline/serveur uniquement, jamais au lancement de l’app mobile.
- Le pipeline initial est dans `scripts/import_mtgjson.py` : lecture JSON/JSON.GZ en streaming, extraction vers SQLite, checksum SHA-256 et provenance de la version/date source.\n- Générer un snapshot compact versionné (SQLite/JSON compressé), conserver la date de génération et la somme de contrôle.
- Ne pas écraser silencieusement les champs Scryfall : chaque champ garde sa provenance et une politique de priorité.

Références :
- https://www.mtgjson.com/
- https://www.mtgjson.com/getting-started/
- https://mtgjson.com/api/v5/

## Magic: The Gathering API historique (magicthegathering.io)
- Le fournisseur annonce officiellement que l’API est dépréciée et continuera de fonctionner jusqu’au **1er mars 2027**, avec migration recommandée vers Scrydex.
- Ne pas démarrer un nouvel adaptateur de production sur cette API vieillissante.

Référence : https://docs.magicthegathering.io/

## Scrydex — successeur possible, serveur uniquement
- Scrydex expose un catalogue Magic et des recherches paginées.
- L’authentification utilise `X-Api-Key` et `X-Team-ID` ; les clés sont sensibles et ne doivent jamais être intégrées dans l’app mobile ou le dépôt.
- Évaluer coûts, crédits, conditions et compatibilité du schéma avant activation. Scryfall reste la source principale tant qu’aucun besoin précis ne justifie ce fournisseur.

Références :
- https://scrydex.com/docs/magicthegathering/cards
- https://scrydex.com/docs/getting-started/authentication

## mtgapi.com
Aucun contrat API officiel suffisamment vérifiable n’a été confirmé pendant cette revue. Ne pas coder d’intégration sur la seule base du nom de domaine ; demander une documentation/version d’API et vérifier licence, disponibilité, champs, authentification et limites avant de l’ajouter.

## Règles d’intégration
1. Scryfall est la source canonique de recherche/Oracle au runtime.
2. MTGJSON sert aux imports bulk et à la résilience hors ligne.
3. Les adaptateurs secondaires ne remplacent jamais les IDs ou layouts multi-faces sans mapping explicite.
4. Les clés API restent côté serveur.
5. Chaque import est daté, versionné, contrôlé par checksum et test de schéma.
