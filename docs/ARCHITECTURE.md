# Architecture technique

## Choix de langages\n- **TypeScript** pour l’app React Native, le serveur Node.js, le moteur et le protocole : partage du modèle de règles, validation statique et absence de pont natif entre client et moteur.\n- **SQL** pour le stockage local SQLite et, plus tard si les comptes/salons l’exigent, PostgreSQL côté service.\n- **Python** réservé aux scripts ponctuels d’ingestion, d’analyse et de contrôle des dumps de données ; pas dans le chemin d’exécution d’une partie.\n- **Rust** n’est pas introduit au démarrage : le coût FFI et la duplication des modèles ne sont justifiés que si un profilage démontre un goulot d’étranglement du moteur.\n\n## Monorepo
- `apps/mobile` : React Native, Expo, TypeScript.
- `apps/server` : Node.js, TypeScript, WebSocket.
- `packages/game-engine` : domaine, état, règles, commandes, événements.
- `packages/card-data` : schéma Scryfall, adaptateurs et cache.
- `packages/protocol` : messages réseau versionnés et validation.
- `packages/ui` : tokens et composants partagés si cela réduit réellement la duplication.

## Autorité métier
Le moteur est indépendant de l'UI, du réseau et des fournisseurs de cartes. Le client envoie une intention ; le serveur vérifie l'identité du siège et la révision, applique le moteur, persiste les événements, puis distribue une vue filtrée. Aucun client ne peut déclarer directement un sort résolu ou un joueur éliminé.

## Déterminisme
Injecter RNG seedé, générateur d'identifiants et horloge. Pas de réseau, timer ou état global dans les fonctions de règles. Les effets de cartes sont représentés par des capacités déclaratives/handlers contrôlés, jamais par exécution arbitraire du texte oracle.

## Stockage et synchronisation
SQLite sur appareil pour decks, cache et reprise locale. Journal d'événements comme source de vérité d'une partie active ; snapshots pour accélérer la reconnexion. PostgreSQL côté service seulement lorsque comptes/salons persistants sont nécessaires.

## Versionnement
Versionner le moteur, le format Commander, le schéma de cartes et le protocole. Une partie conserve ses versions initiales.

## Tests
Unitaires, scénarios séquencés, propriétés d'invariants, régressions de règles, tests de rejeu réseau et tests UI/accessibilité.
