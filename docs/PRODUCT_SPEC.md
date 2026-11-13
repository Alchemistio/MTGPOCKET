# Spécification produit — Commander Pocket

Version 0.1.0 — 13 novembre 2026.

## Vision et plateformes
Jouer à Commander à quatre joueurs sur iOS/Android, d'abord sur téléphone, puis tablette et PC. Modes : réseau local, solo contre IA, entraînement local avec journal et explication des validations.

## Parcours
1. Créer/rejoindre un salon et assigner quatre sièges.
2. Importer/choisir decks et commandants ; valider le format.
3. Effectuer les choix de départ et mulligans.
4. Jouer avec phases, étapes, fenêtres de priorité, pile et choix.
5. Consulter zones, journal, dégâts de commandant et statistiques.

## Règles Commander
Configuration par version : 40 points de vie par défaut, deck singleton de 100 cartes incluant le ou les commandants, identité couleur, bannissements, zone de commandement, taxe de commandant et blessures de commandant. Ces règles de format restent distinctes des Comprehensive Rules. Les joueurs éliminés ne participent plus aux fenêtres de priorité.

## Moteur
Le moteur reçoit un état et une commande, valide les préconditions, puis retourne un nouvel état et des événements. Modèle minimum : Game, Player, Turn, Phase, Step, PriorityWindow, StackItem, CardDefinition, RuntimeCardState, Zone, Counter, Attachment, Combat, CommanderDamage, RuleVersion.

Chaque permanent contient `instance_id`, `controller_id`, `zone`, `is_tapped`, `counters` (p1p1, m1m1, shield, custom), `attached_to`, `damage_marked`. Les données imprimées suivent Scryfall : `id`, `name`, `layout`, `mana_cost`, `cmc`, `type_line`, `oracle_text`, `colors`, `color_identity`, `legalities`, `card_faces[]`.

## Priorité et pile
Ordre de tour en ignorant les joueurs éliminés ; tous les joueurs concernés doivent passer successivement pour fermer une fenêtre. Si la pile est non vide, son sommet est résolu avant la progression. Les déclenchements et actions basées sur un état devront suivre les règles applicables. Auto-Yield et macros ne s'activent que dans des fenêtres sûres et configurées.

## UX mobile
Plateau paysage strict, quatre zones de bataille compactes, télémétrie persistante (vie, main, taxe, mana), geste maintien-glissement pour inspecter les adversaires, piles de permanents avec quantité, badges d'état par icônes/formes, arbre d'attachements au long-press, main et tiroir de pile en panneaux bas. Accessibilité WUBRG : formes/lettres/motifs en plus des couleurs, contrastes et zones tactiles adaptées.

## Données
Scryfall pour recherche/détails oracle/images selon ses conditions ; MTGJSON pour snapshots et traitements en masse. magicthegathering.io et mtgapi.com restent des adaptateurs optionnels, seulement après vérification de disponibilité, couverture et conditions. Cache local, limitation de débit, horodatage et fonctionnement hors ligne. Ne pas intégrer de dumps ou images sans droits de redistribution.

## Réseau et sécurité
Serveur autoritaire : commandes avec idempotency key, joueur, gameId et expectedRevision. Vérifier siège, priorité et légalité avant mutation. Journal d'événements + snapshots pour reprise. Filtrer les informations cachées par destinataire. Solo et réseau utilisent le même moteur.

## Qualité
Reproductibilité via seed/journal, tests unitaires et scénarios, aucune mutation client non validée, couverture des règles documentée, performance sur appareils milieu de gamme et accessibilité.
