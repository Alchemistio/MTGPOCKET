# Moteur de pile — index mémoire

Statut : squelette générique initial, cycle de vie isolé du contenu des effets.

- [Architecture](stack_architecture.md)
- [Roadmap](stack_roadmap.md)
- [Analyse de développement](development_analysis.md)

Point d'entrée runtime : `packages/game-engine/src/stack-engine.ts`.
Le modèle conserve un objet de pile typé par catégorie avec payload opaque. Le moteur possède le cycle de vie (ajout, sommet, verrou de résolution, retrait) ; le contenu est fourni par des interpréteurs injectés.

Nouvelle frontière de dispatch : `packages/game-engine/src/stack-handlers.ts`. Elle décode les payloads et délègue l'effet sans posséder le retrait, les SBA ou la priorité.

Le serveur migre les triggers ETB basiques vers le registre via `basicStackHandlers` dans `apps/server/src/basic-spell-effects.ts`. Les sorts et triggers inconnus gardent leur chemin de résolution existant.

Les sorts instantanés/rituels simples (pioche de 1/2/3 cartes, gain de vie numérique) utilisent également `basicStackHandlers` ; la branche des permanents reste prioritaire et distincte.

Contrat d'activation : `packages/game-engine/src/activated-abilities.ts` fournit `activateStackAbility`, transaction atomique des coûts mana simples + engagement optionnel + insertion d'un StackItem. Les capacités de mana immédiates restent distinctes.
