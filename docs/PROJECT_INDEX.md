# Index général — Commander Pocket

> Point d'entrée documentaire. Dernière revue : 2026-11-13. Mettre cet index à jour dès qu'un document, une décision, une référence ou une étape de livraison change.

## Lecture par besoin

| Besoin | Document | Contenu |
|---|---|---|
| Comprendre le produit | [PRODUCT_SPEC](PRODUCT_SPEC.md) | Périmètre fonctionnel, plateformes, UX et critères |
| Comprendre les modules | [ARCHITECTURE](ARCHITECTURE.md) | Langages, frontières, autorité, persistance |
| Savoir ce que le moteur sait faire | [RULES_SCOPE](RULES_SCOPE.md) | Règles couvertes, CR, lacunes et méthode |
| Savoir ce qui vient ensuite | [ROADMAP](ROADMAP.md) | Jalons, dépendances et Definition of Done |\n| Suivre les tâches concrètes | [GitHub Issues](https://github.com/Alchemistio/MTGPOCKET/issues) | Backlog M1, règles, réseau LAN et données offline |
| Comprendre les fournisseurs | [DATA_SOURCES](DATA_SOURCES.md) | Scryfall, MTGJSON, Scrydex et politique d'intégration |
| Retrouver les docs techniques | [references/README](references/README.md) | Fiches locales, sources officielles, dates et licences |
| Comprendre une décision | [DECISIONS](DECISIONS.md) | ADRs et raisons des choix |
| Retrouver l'historique | [PROJECT_LOG](PROJECT_LOG.md) | Livraisons, tests, incidents et prochaines actions |

## Sources normatives

1. **Comprehensive Rules** : PDF fourni dans le contexte du projet, édition du 25 septembre 2026. Il reste une référence de travail externe au dépôt ; les numéros de règles et les notes de couverture sont dans [RULES_SCOPE](RULES_SCOPE.md). Ne pas redistribuer le PDF ni copier de longs passages.
2. **Commander banlist / format policy** : vérifier la source officielle Commander avant chaque mise à jour de légalité ; les règles de format ne se déduisent pas toutes des Comprehensive Rules.
3. **Card Oracle / données d'impression** : Scryfall en priorité, MTGJSON pour les imports bulk selon [DATA_SOURCES](DATA_SOURCES.md).

## Convention de maintenance documentaire

- Toute nouvelle intégration externe doit ajouter une fiche sous `docs/references/` : URL canonique, date de vérification, version/SDK, résumé utile, limites, licence/conditions et fichiers du repo concernés.
- Toute décision qui modifie une frontière, une technologie ou un format persistant doit être ajoutée à [DECISIONS](DECISIONS.md).
- Chaque session de développement qui change l'état du projet ajoute une entrée datée à [PROJECT_LOG](PROJECT_LOG.md).
- Les tâches ne passent en terminé que si les tests et critères de sortie sont vérifiés. « Codé », « CI verte » et « validé sur appareil » sont trois états différents.
- Les copies locales intégrales de documentation externe ne sont conservées que si les conditions de licence l'autorisent clairement. Sinon, conserver une fiche technique rédigée par le projet, la source canonique et la date de consultation.
- Les fichiers de données volumineux, images de cartes, dumps de fournisseurs et secrets ne sont pas commités par défaut.

## État synthétique au 2026-11-13

- Fondation : présente ; CI du PR #1 observée verte sur le commit contrôlé.
- Moteur : premier périmètre de règles et scénarios testés ; non exhaustif.
- Mobile : plateau, recherche Scryfall/cache et formulaire de salle LAN.
- Réseau : création/join et passage de priorité seulement ; pas encore une partie complète.\n- Règles Commander : retours 903.9a/b modélisés par choix explicites ; le serveur filtre le choix au propriétaire et le client mobile le présente ; 903.9c reste à faire.\n- Backlog : [#2 partie bout en bout](https://github.com/Alchemistio/MTGPOCKET/issues/2), [#3 règles/SBA](https://github.com/Alchemistio/MTGPOCKET/issues/3), [#4 LAN](https://github.com/Alchemistio/MTGPOCKET/issues/4), [#5 index offline](https://github.com/Alchemistio/MTGPOCKET/issues/5).
- Prochain jalon : connecter un deck réel et toutes les commandes nécessaires à un tour complet, puis journaliser/rejouer la partie.
