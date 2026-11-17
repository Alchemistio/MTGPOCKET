import hashlib
import json
import tempfile
import unittest
from pathlib import Path

from build_scryfall_catalog import find_bulk_entry, write_snapshot


class ScryfallCatalogBuilderTests(unittest.TestCase):
    def test_manifest_selects_exact_bulk_type_and_requires_https(self):
        entry = {"type": "default_cards", "download_uri": "https://data.scryfall.io/cards.json",
                 "updated_at": "2026-11-14T02:00:00.000Z"}
        self.assertEqual(find_bulk_entry({"data": [entry]}, "default_cards"), entry)
        with self.assertRaises(ValueError):
            find_bulk_entry({"data": [dict(entry, download_uri="http://example.test/cards")]}, "default_cards")
        with self.assertRaises(ValueError):
            find_bulk_entry({"data": [entry, entry]}, "default_cards")

    def test_writes_streamed_snapshot_with_provenance_and_multiface_data(self):
        card = {
            "id": "11111111-1111-4111-8111-111111111111",
            "oracle_id": "22222222-2222-4222-8222-222222222222",
            "name": "Two-Faced Test", "layout": "transform", "mana_cost": "{1}{U}",
            "cmc": 2, "type_line": "Creature — Wizard", "oracle_text": "Front text",
            "colors": ["U"], "color_identity": ["U"], "legalities": {"commander": "legal"},
            "card_faces": [{"name": "Front"}, {"name": "Back", "oracle_text": "Back text"}],
            "set": "tst", "collector_number": "007a"
        }
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source, output = root / "bulk.json", root / "snapshot.json"
            source.write_text(json.dumps([card]), encoding="utf-8")
            count = write_snapshot(source, output, updated_at="2026-11-14T02:00:00.000Z",
                                   download_uri="https://data.scryfall.io/cards.json",
                                   bulk_type="default_cards")
            snapshot = json.loads(output.read_text(encoding="utf-8"))
            self.assertEqual(count, 1)
            self.assertEqual(snapshot["cards"][0]["card_faces"][1]["oracle_text"], "Back text")
            self.assertEqual(snapshot["sourceSha256"], hashlib.sha256(source.read_bytes()).hexdigest())
            self.assertEqual(snapshot["sourceUpdatedAt"], "2026-11-14")
            self.assertEqual(snapshot["sourceBulkType"], "default_cards")

    def test_rejects_empty_or_malformed_bulk_without_replacing_output(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source, output = root / "bulk.json", root / "snapshot.json"
            output.write_text("previous-good-snapshot", encoding="utf-8")
            source.write_text("[]", encoding="utf-8")
            with self.assertRaises(ValueError):
                write_snapshot(source, output, updated_at="2026-11-14T02:00:00Z",
                               download_uri="https://example.test/cards", bulk_type="default_cards")
            self.assertEqual(output.read_text(encoding="utf-8"), "previous-good-snapshot")
            source.write_text("[{}]", encoding="utf-8")
            with self.assertRaises(ValueError):
                write_snapshot(source, output, updated_at="2026-11-14T02:00:00Z",
                               download_uri="https://example.test/cards", bulk_type="default_cards")


if __name__ == "__main__":
    unittest.main()
