# Référence locale — Scryfall API

- **Vérifié :** 2026-11-13.
- **Docs canoniques :** https://scryfall.com/docs/api
- **Cards :** https://scryfall.com/docs/api/cards
- **Bulk data :** https://scryfall.com/docs/api/bulk-data
- **Rate limits / erreurs :** https://scryfall.com/docs/faqs/i-m-having-trouble-accessing-the-scryfall-api-or-i-m-blocked

## Politique d'utilisation confirmée

- API HTTPS ; chaque requête doit porter un `User-Agent` descriptif et un en-tête `Accept` approprié.
- Scryfall demande de maintenir le trafic soutenu **sous 10 requêtes/seconde**.
- Les réponses 429 ne doivent pas être ignorées ni suivies de retries agressifs ; réduire la cadence et appliquer backoff.
- Pour les lookups massifs, utiliser les exports Bulk Data plutôt que des milliers de requêtes unitaires.
- Les fichiers bulk sont répertoriés via le endpoint `/bulk-data` ; le manifeste fournit notamment le type, la date de mise à jour et l'URL de téléchargement.
- Les données de prix des exports peuvent être périmées ; ne pas en faire une donnée transactionnelle.
- Respecter les politiques d'images et d'attribution de Scryfall.

## Modèle de carte à préserver

Le modèle interne doit accepter les propriétés Scryfall sans les réduire : `id`, `oracle_id`, `name`, `layout`, `mana_cost`, `cmc`, `type_line`, `oracle_text`, `colors`, `color_identity`, `legalities`, `card_faces[]`, `image_uris`, `all_parts` et les champs optionnels. Ne pas supposer qu'une carte a une seule face ou une image unique.

## Architecture d'adaptateur

- Garder le JSON source/provenance et mapper vers un modèle de domaine versionné.
- Distinguer carte Oracle et impression (printing) ; un nom n'est pas une clé.
- Cache par ID et recherche normalisée ; coalescer les requêtes identiques.
- Utiliser les bulk snapshots pour indexer localement ; les recherches interactives peuvent utiliser l'API live.
- Tester les layouts : normal, transform, modal_dfc, split, adventure, flip, meld, prototype, saga, class, battle et autres nouveaux layouts.

Cette fiche est une synthèse de travail ; les schémas et champs canoniques évoluent, vérifier la documentation source lors d'une mise à jour.
