# Moteur de pile — index mémoire

Statut : squelette générique initial, cycle de vie isolé du contenu des effets.

- [Architecture](stack_architecture.md)
- [Roadmap](stack_roadmap.md)
- [Analyse de développement](development_analysis.md)

Point d'entrée runtime : `packages/game-engine/src/stack-engine.ts`.
Le modèle conserve un objet de pile typé par catégorie avec payload opaque. Le moteur possède le cycle de vie (ajout, sommet, verrou de résolution, retrait) ; le contenu est fourni par des interpréteurs injectés.

Nouvelle frontière de dispatch : packages/game-engine/src/stack-handlers.ts. Elle décode les payloads et délègue l'effet sans posséder le retrait, les SBA ou la priorité.
