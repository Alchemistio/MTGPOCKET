# ETB — roadmap du module complet

Cette roadmap complète `docs/ROADMAP.md`. Elle privilégie une mécanique générique plutôt qu'une progression carte par carte.

## ETB-0 — Contrat d'événement et changements de zone (fondation obligatoire)
- [ ] Centraliser chaque changement de zone dans un processeur métier.
- [ ] Introduire événements proposés/commis et groupe de simultanéité.
- [ ] Conserver identité avant/après, owner/controller, cause et informations connues.
- [ ] Préparer l'interception par remplacements/préventions (614.12, 616.1) et distinguer entrée modifiée d'un trigger (603.6d).
- [ ] Tests : événement remplacé, mouvements simultanés, token, contrôle et nouvelle identité.

## ETB-1 — Détection générique (toutes sources pertinentes)
- [ ] Compiler « When this enters », « Whenever a creature enters », « Whenever another permanent enters », etc. vers TriggerSpec.
- [ ] Scanner toutes les sources pertinentes, entrants compris ; appliquer les zones de fonctionnement de 113.6, y compris les exceptions hors battlefield.
- [ ] Capturer le contrôleur au moment du trigger.
- [ ] Conditions simples et occurrences multiples.
- [ ] Tests : source elle-même, autre permanent, plusieurs entrants, types modifiés par effets continus.

## ETB-2 — Timing, priorité et APNAP (checkpoint CR 117.5)
- [ ] Accumuler les candidats jusqu'au prochain checkpoint de priorité.
- [ ] SBA avant priorité et collecte des triggers qui en résultent ; répéter jusqu'à stabilisation.
- [ ] Ordre APNAP et ordre choisi par chaque joueur ; deux groupes de 603.3b.
- [ ] Répéter SBA → triggers jusqu'à stabilisation.
- [ ] Tests à 2/4 joueurs, plusieurs contrôleurs, plusieurs triggers par joueur et SBA induites.

## ETB-3 — Conditions, choix, modes et cibles
- [ ] Intervening-if vérifié au trigger et à la résolution.
- [ ] Modes choisis au placement sur la pile.
- [ ] Cibles légales, choix obligatoires/facultatifs et aucune cible légale.
- [ ] « You may » empilé même si le contrôleur refuse ensuite.
- [ ] Tests de cibles illégales, choix impossibles et résolution partielle.

## ETB-4 — Entrées modifiées et caractéristiques
- [ ] « Enters tapped/with counters/as a copy/as [type] » via effets statiques/remplacements, pas faux trigger.
- [ ] Appliquer 614.12/616.1 et choix pré-entrée.
- [ ] Recalculer couches/caractéristiques ; déterminer capacités présentes au moment pertinent.
- [ ] Tests d'effets globaux, auto-remplacements et interactions.

## ETB-5 — Références, identité d'objet et familles avancées
- [ ] Last known information, exceptions de 400.7 et références après changement de zone.
- [ ] Source quittant le battlefield avant résolution.
- [ ] Tokens, copies, multi-faces, face-down, meld, blink, réanimation et entrées simultanées.
- [ ] Capacités retardées/réflexives et capacités liées.

## ETB-6 — Compilation Oracle et corpus
- [ ] Remplacer les motifs exacts actuels par un compilateur Oracle partagé et une IR typée.
- [ ] Corpus Scryfall par motif grammatical, incluant multi-faces/layouts.
- [ ] Mesurer parse, semantic et execution coverage séparément.
- [ ] Tests différentiels et scénarios déterministes/rejouables.
- [ ] Exception carte-spécifique uniquement avec justification, test et règle CR.

## ETB-7 — Couverture des cartes et robustesse en continu
- [ ] Générer des fixtures à partir des cartes Scryfall/Oracle, groupées par motif de trigger et d'effet.
- [ ] Détecter les formulations inconnues et produire un diagnostic stable (règles candidates, token non reconnu, raison d'échec).
- [ ] Mesurer les cartes totalement supportées, partiellement supportées et non supportées ; ne jamais afficher une carte « jouable » si une capacité obligatoire est ignorée.
- [ ] Ajouter des tests différentiels pour les régressions de parseur et des tests de propriété pour les événements simultanés/replacements.

## Critères de sortie
- Sous-aspects pertinents de 603.6, 603.2–603.5, 603.3a–d, 603.7, 603.10–603.12 et règles adjacentes reliés à des tests.
- Aucun trigger supporté perdu ou résolu au mauvais moment dans scénarios simultanés/APNAP.
- Les textes non compilés sont explicitement non supportés, jamais ignorés silencieusement.
- Rejeu, persistance, confidentialité et scénarios à quatre sièges couverts.
