import gzip
import json
import sqlite3
import tempfile
import unittest
from pathlib import Path

from import_mtgjson import import_all_printings


class MtgJsonImportTests(unittest.TestCase):
    def test_streams_gzip_and_preserves_source_identifiers(self):
        payload = {
            "meta": {"version": "5.2.0", "date": "2026-11-13"},
            "data": {
                "TST": {
                    "name": "Test Set",
                    "releaseDate": "2026-11-13",
                    "type": "expansion",
                    "cards": [{
                        "uuid": "uuid-1",
                        "name": "Example Wizard",
                        "number": "007a",
                        "layout": "transform",
                        "colors": ["U"],
                        "colorIdentity": ["U"],
                        "manaCost": "{1}{U}",
                        "manaValue": 2,
                        "type": "Creature — Wizard",
                        "text": "Example text",
                        "identifiers": {
                            "scryfallId": "scryfall-1",
                            "scryfallOracleId": "oracle-1"
                        },
                        "legalities": {"commander": "Legal"},
                        "otherFaceIds": ["uuid-2"]
                    }]
                }
            }
        }
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            source = root / "AllPrintings.json.gz"
            output = root / "cards.sqlite"
            with gzip.open(source, "wt", encoding="utf-8") as stream:
                json.dump(payload, stream)
            set_count, card_count = import_all_printings(source, output)
            self.assertEqual((set_count, card_count), (1, 1))
            with sqlite3.connect(output) as db:
                row = db.execute(
                    "SELECT name,collector_number,scryfall_id,oracle_id,layout FROM card_printings"
                ).fetchone()
                self.assertEqual(row, ("Example Wizard", "007a", "scryfall-1", "oracle-1", "transform"))
                meta = dict(db.execute("SELECT key,value FROM import_metadata"))
                self.assertEqual(meta["source_version"], "5.2.0")
                self.assertEqual(meta["source"], "MTGJSON")


if __name__ == "__main__":
    unittest.main()
