# Registre des décisions d'architecture (ADR)

Les décisions sont numérotées et append-only. Une décision remplacée est marquée « Superseded » et pointe vers la nouvelle ADR.

## ADR-0001 — TypeScript partagé pour le client, le serveur et le moteur

- **Statut :** accepté.
- **Décision :** TypeScript strict pour React Native/Expo, Node.js, moteur de règles et protocole.
- **Raison :** modèle de domaine partagé, validation statique, mêmes scénarios de règles côté client et serveur, pas de pont natif à maintenir.
- **Conséquence :** le moteur doit rester indépendant de React Native et Node APIs ; les fonctions métier doivent être déterministes et injecter RNG/horloge/ID.

## ADR-0002 — Python uniquement pour les pipelines de données

- **Statut :** accepté.
- **Décision :** Python pour ingestion, validation, conversion et rapports de dumps MTGJSON/Scryfall ; pas dans la boucle d'une partie.
- **Raison :** outillage ETL mature sans fragmenter le runtime de jeu.

## ADR-0003 — SQLite offline-first sur mobile

- **Statut :** accepté.
- **Décision :** SQLite via expo-sqlite pour cartes mises en cache, decks et données locales.
- **Raison :** persistance locale, requêtes structurées, disponibilité sans réseau.
- **Conséquence :** migrations versionnées, transactions et paramètres SQL liés ; ne pas interpoler des entrées utilisateur dans les requêtes.

## ADR-0004 — Scryfall runtime, MTGJSON bulk

- **Statut :** accepté.
- **Décision :** Scryfall pour recherche et objets Oracle au runtime ; MTGJSON comme source secondaire de dumps et de rapprochements.
- **Raison :** API carte et fichiers bulk dédiés, limite de requêtes documentée, besoin de fonctionnement hors ligne.
- **Conséquence :** adaptateurs isolés et provenance par champ ; jamais de scraping ni de boucle de lookups massifs.

## ADR-0005 — Le serveur est l'autorité de la partie réseau

- **Statut :** accepté.
- **Décision :** le client envoie des commandes d'intention versionnées ; le serveur vérifie siège, autorisation et révision, applique le moteur, journalise et renvoie une vue filtrée.
- **Raison :** empêcher un client de falsifier vie, main, pile ou résolution.
- **Conséquence :** la simulation locale et la partie LAN doivent appeler les mêmes fonctions de domaine.

## ADR-0006 — Pas de Rust prématuré

- **Statut :** accepté.
- **Décision :** ne pas ajouter Rust tant qu'un profilage du moteur TypeScript n'a pas identifié un goulot concret.
- **Raison :** éviter coût FFI, builds iOS/Android et duplication des modèles sans bénéfice mesuré.

## ADR-0007 — Documentation locale sous forme de fiches, pas de copies non autorisées

- **Statut :** accepté.
- **Décision :** stocker des synthèses techniques rédigées par le projet, versions, décisions, extraits minimaux nécessaires, liens canoniques et dates ; ne committer une copie intégrale que si la licence/autorisation le permet.
- **Raison :** documentation retrouvable hors ligne sans redistribuer de contenu tiers protégé.
