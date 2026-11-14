# Serveur Commander Pocket

Serveur Node.js + TypeScript + WebSocket pour les parties sur réseau local.

## Démarrage

```sh
pnpm install
pnpm --filter @commander-pocket/server dev
```

- Health check : GET http://<ip-hôte>:3000/health
- WebSocket : ws://<ip-hôte>:3000/ws

## Générer le catalogue Scryfall

Installer la dépendance de streaming puis produire un snapshot local (bulk Scryfall complet, téléchargement réseau requis) :

```sh
python -m pip install -r scripts/requirements.txt
python scripts/build_scryfall_catalog.py --output ./data/scryfall-catalog.json
```

Le script utilise le bulk `default_cards`, conserve les objets Scryfall et `card_faces[]`, ajoute provenance + SHA-256, et remplace le fichier de sortie seulement après génération complète. Contrôler le hash et la date avant déploiement. Le bulk peut être volumineux : prévoir espace disque pour le téléchargement temporaire et le snapshot final.

## Pré-partie serveur

Le démarrage active la pré-partie uniquement si les deux variables suivantes pointent vers des fichiers locaux valides :

- CPOCKET_CARD_CATALOG_PATH : snapshot JSON Scryfall, schemaVersion=1, source=scryfall, sourceUpdatedAt (date ISO) et cards[] contenant les objets Card Scryfall.
- CPOCKET_COMMANDER_POLICY_PATH : policy JSON versionnée, schemaVersion=1, version, effectiveDate, bannedOracleIds, commanderEligibleOracleIds, compatibleCommanderPairs, multipleCopiesAllowedOracleIds; optionnellement deckNameKeyByOracleId.

Les IDs de policy sont des Oracle IDs UUID. L'éligibilité commandant et les paires compatibles sont des listes explicites, maintenues côté serveur. Les cartes bannies dans la policy sont forcées à commander=banned. Les deux fichiers sont obligatoires ensemble ; une configuration partielle ou invalide fait échouer le démarrage. Sans les deux chemins, le serveur démarre mais répond PREGAME_NOT_CONFIGURED.

Exemple :

```sh
CPOCKET_CARD_CATALOG_PATH=/srv/commander-pocket/scryfall-catalog.json \
CPOCKET_COMMANDER_POLICY_PATH=/srv/commander-pocket/commander-policy.json \
pnpm --filter @commander-pocket/server start
```

Ne pas committer de dump bulk, de données utilisateur ou de secrets. Provisionner les snapshots hors bande, contrôler provenance/checksum et réviser la policy avant chaque mise à jour. Aucun contrôle de légalité ne fait confiance aux métadonnées envoyées par le mobile.

## Effets de cartes pris en charge

Lorsque catalogue et policy sont tous deux configurés, le bootstrap injecte un résolveur volontairement limité aux cartes de layout `normal`, type Instant/Sorcery, coût simple (symboles W/U/B/R/G/C et générique numérique), sans cible, et texte Oracle exact : `Draw a card.`, `Draw two cards.`, `Draw three cards.` ou `You gain N life.`. Les autres textes ne sont pas interprétés et ne doivent pas être traités comme des effets résolus. Étendre cette liste seulement avec un handler et des tests dédiés.

## Messages réseau

Créer une salle avec create-room et quatre sièges, rejoindre avec join-room et jeton personnel, puis envoyer command pour les actions de jeu. Les vues sont projetées par joueur : les mains adverses et identités de bibliothèque ne sont pas envoyées.

## Limites

Les commandes de jeu autres que pass-priority, la persistance, la découverte automatique LAN, TLS, la reconnexion et la reprise ne sont pas activés. Les jetons sont distribués par l'hôte : réserver ce mode au réseau local de confiance jusqu'à l'ajout d'un flux d'invitation sécurisé.
