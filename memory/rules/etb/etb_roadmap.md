# ETB — roadmap du module complet

Cette roadmap complète `docs/ROADMAP.md`. Elle privilégie une mécanique générique plutôt qu'une progression carte par carte.

**Avancement 2026-11-17 :** pipeline typé de remplacement avant commit : proposition immuable, catégories ordonnées, choix explicite en cas de concurrence, réévaluation, prévention sans commit et trace sur l'événement. Les effets Oracle concrets, événements imbriqués et choix APNAP simultanés restent à implémenter.

## ETB-0 — Contrat d'événement et changements de zone
- [x] Contrat `ZoneChangeEvent` : snapshots, LKI, contrôleur avant/après, cause, groupe et trace de remplacement.
- [x] Processeur canonique single-move pour l'entrée par résolution de sort.
- [x] Groupe de simultanéité et événements commis pour déplacements batchés indépendants.
- [x] Proposition d'événement et pipeline de remplacement avant commit.
- [x] Catégories 616.1a-e, réévaluation après application et non-répétition d'un effet sur le même événement (614.5).
- [x] Suspension sur choix explicite lorsqu'il existe plusieurs remplacements concurrents dans la première catégorie applicable.
- [x] Prévention sans commit et sans événement de changement de zone.
- [ ] Migrer tous les chemins vers un dispatcher commun (SBA, terrains, effets, commandant, élimination).
- [ ] Événements imbriqués, choix 614.12 pré-entrée, caractéristiques de l'objet entrant et choix APNAP simultanés (614.12-13, 616.1f-g).
- [ ] Tests tokens et nouvelle identité d'objet.

## ETB-1 — Détection générique
- [ ] Compiler les motifs « When this enters », « Whenever a creature enters », « Whenever another permanent enters » vers `TriggerSpec`.
- [ ] Scanner les sources pertinentes, entrants compris, et respecter les zones de fonctionnement de 113.6.
- [ ] Capturer le contrôleur au moment du trigger ; occurrences multiples.
- [ ] Tests source elle-même, autre permanent, plusieurs entrants et types modifiés.

## ETB-2 — Timing, priorité et APNAP
- [ ] Accumuler les candidats jusqu'au checkpoint de priorité (117.5).
- [ ] SBA avant priorité et collecte des triggers ; répéter jusqu'à stabilisation.
- [ ] Ordre APNAP et ordre choisi par chaque joueur (603.3b).
- [ ] Tests à 2/4 joueurs, contrôleurs multiples et SBA induites.

## ETB-3 — Conditions, choix, modes et cibles
- [ ] Intervening-if au trigger et à la résolution.
- [ ] Modes au placement sur la pile ; cibles légales et choix obligatoires/facultatifs.
- [ ] Résolution partielle et absence de cible légale.

## ETB-4 — Entrées modifiées et caractéristiques
- [ ] « Enters tapped/with counters/as a copy/as [type] » via effets statiques/remplacements, pas faux trigger.
- [ ] Appliquer 614.12/616.1 et choix pré-entrée.
- [ ] Recalculer couches/caractéristiques et capacités pertinentes.

## ETB-5 — Références et identité d'objet
- [ ] LKI, exceptions 400.7 et références après changement de zone.
- [ ] Source quittant le battlefield avant résolution.
- [ ] Tokens, copies, multi-faces, face-down, meld, blink, réanimation et entrées simultanées.
- [ ] Capacités retardées/réflexives et capacités liées.

## ETB-6 — Compilation Oracle et corpus
- [ ] Compilateur Oracle partagé et IR typée.
- [ ] Corpus Scryfall par motif, incluant multi-faces/layouts.
- [ ] Mesurer parse, semantic et execution coverage séparément.
- [ ] Tests différentiels et scénarios déterministes/rejouables.

## ETB-7 — Couverture et robustesse
- [ ] Fixtures Scryfall/Oracle par famille.
- [ ] Mesurer les régressions ETB et non-ETB.
- [ ] Versionner les règles supportées et exposer les capacités non prises en charge.
