from __future__ import annotations

import ast
import json
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
RULES = ROOT / "Rules_Engine"
SOURCE = RULES / "source" / "MagicCompRules_20261106.txt"
INDEX = RULES / "index"


class ComprehensiveRulesIndexTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.raw = SOURCE.read_bytes()
        cls.lines = cls.raw.decode("utf-8-sig").splitlines()
        cls.raw_lines = cls.raw.splitlines(keepends=True)
        cls.manifest = json.loads((INDEX / "index_manifest.json").read_text(encoding="utf-8"))

    def test_every_numbered_rule_and_heading_is_indexed_once(self) -> None:
        seen: set[str] = set()
        counts = {"rule": 0, "section": 0, "chapter": 0}
        for chapter in range(1, 10):
            path = INDEX / f"rules_chapter_{chapter}.jsonl"
            rows = [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line]
            self.assertTrue(rows, f"chapter {chapter} index must not be empty")
            for row in rows:
                self.assertIn(row["kind"], counts)
                counts[row["kind"]] += 1
                self.assertTrue(row["summary"])
                self.assertTrue(row["keywords"])
                self.assertGreaterEqual(row["line_start"], 1)
                self.assertGreaterEqual(row["line_end"], row["line_start"])
                self.assertLessEqual(row["line_end"], len(self.lines))
                source_line = self.lines[row["line_start"] - 1]
                self.assertTrue(source_line.startswith(row["id"]), row["id"])
                if row["kind"] == "rule":
                    self.assertNotIn(row["id"], seen, f"duplicate rule {row['id']}")
                    seen.add(row["id"])
                    self.assertIn("related_rules", row)
        self.assertEqual(counts["rule"], self.manifest["counts"]["rules"])
        self.assertEqual(counts["section"], self.manifest["counts"]["sections"])
        self.assertEqual(counts["chapter"], self.manifest["counts"]["chapters"])
        self.assertEqual(len(seen), counts["rule"])

    def test_glossary_is_complete_and_positions_are_exact(self) -> None:
        path = INDEX / "glossary_index.jsonl"
        rows = [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line]
        self.assertEqual(len(rows), self.manifest["counts"]["glossary_terms"])
        for row in rows:
            self.assertTrue(row["term"])
            self.assertTrue(row["summary"])
            self.assertTrue(row["keywords"])
            loc = row["source_location"]
            start = loc["line_start"] - 1
            end = loc["line_end"] - 1
            self.assertEqual(self.lines[start].strip(), row["term"])
            byte_start = sum(len(line) for line in self.raw_lines[:start])
            byte_end = byte_start + sum(len(line) for line in self.raw_lines[start:end]) + len(self.raw_lines[end].rstrip(b"\r\n"))
            self.assertEqual(loc["utf8_byte_start"], byte_start)
            self.assertEqual(loc["utf8_byte_end_exclusive"], byte_end)

    def test_index_generator_is_valid_python(self) -> None:
        generator = RULES / "tools" / "build_rule_index.py"
        ast.parse(generator.read_text(encoding="utf-8"))

    def test_manifest_points_to_the_current_source(self) -> None:
        self.assertEqual(self.manifest["edition"], "2026-11-06")
        self.assertEqual(self.manifest["source_file"], "Rules_Engine/source/MagicCompRules_20261106.txt")
        self.assertEqual(self.manifest["source_line_count"], len(self.lines))


if __name__ == "__main__":
    unittest.main()
