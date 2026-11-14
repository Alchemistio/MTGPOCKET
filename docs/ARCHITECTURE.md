# Architecture technique

## Choix des langages
- **TypeScript** pour React Native, le serveur Node.js, le moteur et le protocole : partage du domaine, validation statique et absence de pont natif entre client et moteur.
- **SQL** pour SQLite mobile et, si les comptes/salons l'exigent, PostgreSQL côté service.
- **Python** pour ingestion, analyse et validation de dumps ; jamais dans le runtime d'une partie.
- **Rust** seulement si un profilage prouve un goulot TypeScript et si le coût FFI/build mobile est justifié.

## Monorepo
- `apps/mobile` : React Native, Expo, TypeScript.
- `apps/server` : Node.js, TypeScript, WebSocket.
- `packages/game-engine` : domaine, état, règles, commandes, événements.
- `packages/card-data` : schéma Scryfall, adaptateurs et cache.
- `packages/protocol` : messages réseau versionnés et validation.

## Autorité métier
Le moteur est indépendant de l'UI, du réseau et des fournisseurs de cartes. Le client envoie une intention ; le serveur vérifie siège, autorisation et révision, applique le moteur, journalise les événements puis distribue une vue filtrée. Aucun client ne déclare directement un sort résolu ou un joueur éliminé.

## Déterminisme
Injecter RNG seedé, générateur d'identifiants et horloge. Pas de réseau, timer ou état global dans les fonctions de règles. Les effets sont représentés par des capacités déclaratives/handlers contrôlés, jamais par exécution arbitraire du texte Oracle.

## Stockage et synchronisation
SQLite sur appareil pour decks, cache et données hors ligne. Journal d'événements comme source de vérité d'une partie active ; snapshots pour accélérer la reconnexion. PostgreSQL uniquement lorsque les comptes/salons persistants seront nécessaires.

## Versionnement
Versionner le moteur, le format Commander, le schéma de cartes et le protocole. Une partie conserve ses versions initiales.

## Tests
Unitaires, scénarios séquencés, propriétés d'invariants, régressions de règles, rejeu réseau, migration SQLite et tests UI/accessibilité.
