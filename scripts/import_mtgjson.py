#!/usr/bin/env python3
"""Stream MTGJSON AllPrintings into a compact, provenance-aware SQLite snapshot."""

from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import BinaryIO, Iterator

import ijson


SCHEMA = """
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
CREATE TABLE IF NOT EXISTS import_metadata (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sets (
    set_code TEXT PRIMARY KEY,
    name TEXT,
    release_date TEXT,
    set_type TEXT,
    raw_json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS card_printings (
    uuid TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    set_code TEXT NOT NULL,
    collector_number TEXT,
    layout TEXT,
    scryfall_id TEXT,
    oracle_id TEXT,
    colors_json TEXT NOT NULL,
    color_identity_json TEXT NOT NULL,
    mana_cost TEXT,
    mana_value REAL,
    type_line TEXT,
    oracle_text TEXT,
    power TEXT,
    toughness TEXT,
    legalities_json TEXT NOT NULL,
    raw_json TEXT NOT NULL,
    FOREIGN KEY(set_code) REFERENCES sets(set_code)
);
CREATE INDEX IF NOT EXISTS idx_card_name ON card_printings(name);
CREATE INDEX IF NOT EXISTS idx_card_scryfall_id ON card_printings(scryfall_id);
CREATE INDEX IF NOT EXISTS idx_card_oracle_id ON card_printings(oracle_id);
"""


def open_source(path: Path) -> BinaryIO:
    if path.suffix.lower() == ".gz":
        return gzip.open(path, "rb")
    return path.open("rb")


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def json_text(value: object) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def iter_sets(path: Path) -> Iterator[tuple[str, dict]]:
    with open_source(path) as source:
        yield from ijson.kvitems(source, "data", use_float=True)


def import_all_printings(source_path: Path, output_path: Path) -> tuple[int, int]:
    if not source_path.is_file():
        raise FileNotFoundError(source_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    checksum = sha256_file(source_path)
    imported_at = datetime.now(timezone.utc).isoformat()

    with sqlite3.connect(output_path) as db:
        db.executescript(SCHEMA)
        db.execute("DELETE FROM card_printings")
        db.execute("DELETE FROM sets")
        db.execute("DELETE FROM import_metadata")

        with open_source(source_path) as source:
            source_meta = next(ijson.items(source, "meta", use_float=True), {})

        card_count = 0
        set_count = 0
        for set_code, set_data in iter_sets(source_path):
            if not isinstance(set_data, dict):
                continue
            db.execute(
                "INSERT OR REPLACE INTO sets(set_code,name,release_date,set_type,raw_json) VALUES(?,?,?,?,?)",
                (
                    set_code,
                    set_data.get("name"),
                    set_data.get("releaseDate"),
                    set_data.get("type"),
                    json_text(set_data),
                ),
            )
            rows = []
            for card in set_data.get("cards", []):
                if not isinstance(card, dict) or not card.get("uuid") or not card.get("name"):
                    continue
                identifiers = card.get("identifiers") or {}
                rows.append((
                    card["uuid"], card["name"], set_code, str(card.get("number") or ""),
                    card.get("layout"), identifiers.get("scryfallId"),
                    identifiers.get("scryfallOracleId"), json_text(card.get("colors") or []),
                    json_text(card.get("colorIdentity") or []), card.get("manaCost"),
                    card.get("manaValue"), card.get("type"), card.get("text"),
                    card.get("power"), card.get("toughness"),
                    json_text(card.get("legalities") or {}), json_text(card),
                ))
            db.executemany(
                """INSERT OR REPLACE INTO card_printings(
                    uuid,name,set_code,collector_number,layout,scryfall_id,oracle_id,
                    colors_json,color_identity_json,mana_cost,mana_value,type_line,
                    oracle_text,power,toughness,legalities_json,raw_json
                ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                rows,
            )
            card_count += len(rows)
            set_count += 1
            db.commit()

        metadata = {
            "source": "MTGJSON",
            "source_file": source_path.name,
            "source_sha256": checksum,
            "source_version": str(source_meta.get("version", "unknown")),
            "source_date": str(source_meta.get("date", "unknown")),
            "imported_at": imported_at,
            "card_printing_count": str(card_count),
            "set_count": str(set_count),
        }
        db.executemany(
            "INSERT INTO import_metadata(key,value) VALUES(?,?)",
            metadata.items(),
        )
        db.commit()

    return set_count, card_count


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True, type=Path, help="MTGJSON AllPrintings.json or .json.gz")
    parser.add_argument("--output", required=True, type=Path, help="Output SQLite database")
    args = parser.parse_args()
    sets, cards = import_all_printings(args.input, args.output)
    print(f"Imported {cards} card printings from {sets} sets into {args.output}")


if __name__ == "__main__":
    main()
