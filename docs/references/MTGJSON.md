# Référence locale — MTGJSON v5

- **Vérifié :** 2026-11-13.
- **Index bulk :** https://mtgjson.com/api/v5/
- **Documentation :** https://www.mtgjson.com/
- **Démarrage :** https://www.mtgjson.com/getting-started/

## État de l'index consulté

L'index v5 listait des snapshots datés du 11 novembre 2026, dont `AllPrintings.json`, `AllPrintings.json.gz`, SQLite et des variantes compressées. L'index expose aussi des fichiers de checksum SHA-256. Les tailles observées sont importantes : l'archive AllPrintings JSON non compressée dépassait 650 MiB ; choisir un format compressé et un traitement streaming.

## Usage dans le projet

- Pipeline hors runtime mobile : téléchargement, vérification SHA-256, extraction vers SQLite, journal de provenance.
- Conserver la version MTGJSON, date du snapshot, URL, checksum, date d'import et version du schéma local.
- Ne pas committer les snapshots volumineux dans Git ; publier les artefacts de données séparément si leur licence et taille le permettent.
- Ne pas traiter MTGJSON comme source Oracle plus autoritaire que Scryfall sans politique de résolution champ par champ.
- Les identifiants MTGJSON et Scryfall doivent être rapprochés explicitement, jamais par nom seulement.

## Pipeline local

Le script `scripts/import_mtgjson.py` et ses tests sont le point d'entrée actuel. Avant de considérer l'import complet prêt : tester archive compressée réelle, mémoire plafonnée, interruption/reprise, checksum invalide, données manquantes et évolution de schéma.

La fiche ne copie aucun dump ni documentation intégrale MTGJSON.
