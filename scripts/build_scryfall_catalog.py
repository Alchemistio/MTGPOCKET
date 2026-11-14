#!/usr/bin/env python3
"""Build a streaming Scryfall Bulk Data snapshot for the Commander Pocket server."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import tempfile
import urllib.request
from datetime import date
from pathlib import Path
from typing import BinaryIO

import ijson

API_BULK_DATA = "https://api.scryfall.com/bulk-data"
USER_AGENT = "CommanderPocket/0.1.0 (Scryfall bulk snapshot builder)"
REQUIRED_CARD_FIELDS = ("id", "name", "layout", "cmc", "type_line", "colors",
                        "color_identity", "legalities", "set", "collector_number")


def request_json(url: str) -> dict:
    request = urllib.request.Request(
        url, headers={"User-Agent": USER_AGENT, "Accept": "application/json"}
    )
    with urllib.request.urlopen(request, timeout=60) as response:
        value = json.load(response)
    if not isinstance(value, dict):
        raise ValueError("Scryfall API returned an unexpected JSON document")
    return value


def find_bulk_entry(manifest: dict, bulk_type: str) -> dict:
    data = manifest.get("data")
    if not isinstance(data, list):
        raise ValueError("Scryfall bulk manifest has no data array")
    matches = [entry for entry in data if isinstance(entry, dict) and entry.get("type") == bulk_type]
    if len(matches) != 1:
        raise ValueError(f"Expected exactly one Scryfall bulk entry of type {bulk_type!r}")
    entry = matches[0]
    if not isinstance(entry.get("download_uri"), str) or not entry["download_uri"].startswith("https://"):
        raise ValueError("Scryfall bulk entry has no HTTPS download_uri")
    updated_at = entry.get("updated_at")
    if not isinstance(updated_at, str) or len(updated_at) < 10:
        raise ValueError("Scryfall bulk entry has no updated_at timestamp")
    date.fromisoformat(updated_at[:10])
    return entry


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def write_snapshot(source_path: Path, output_path: Path, *, updated_at: str,
                   download_uri: str, bulk_type: str) -> int:
    """Stream the top-level Scryfall cards array into the server snapshot."""
    date.fromisoformat(updated_at[:10])
    checksum = sha256_file(source_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    temporary_path = output_path.with_name(output_path.name + ".tmp")
    count = 0
    try:
        with source_path.open("rb") as source, temporary_path.open("w", encoding="utf-8") as target:
            target.write(json.dumps({
                "schemaVersion": 1,
                "source": "scryfall",
                "sourceUpdatedAt": updated_at[:10],
                "sourceBulkType": bulk_type,
                "sourceBulkUpdatedAt": updated_at,
                "sourceBulkUri": download_uri,
                "sourceSha256": checksum,
                "cards": []
            }, ensure_ascii=False)[:-2])
            target.write("[")
            first = True
            for card in ijson.items(source, "item", use_float=True):
                if not isinstance(card, dict) or any(field not in card for field in REQUIRED_CARD_FIELDS):
                    raise ValueError(f"Malformed Scryfall card at bulk index {count}")
                if not isinstance(card["id"], str) or not isinstance(card["name"], str):
                    raise ValueError(f"Malformed Scryfall card identifiers at bulk index {count}")
                if not isinstance(card["cmc"], (int, float)) or not isinstance(card["legalities"], dict):
                    raise ValueError(f"Malformed Scryfall card fields at bulk index {count}")
                if not first:
                    target.write(",")
                json.dump(card, target, ensure_ascii=False, separators=(",", ":"), allow_nan=False)
                first = False
                count += 1
            if count == 0:
                raise ValueError("Scryfall bulk file contains no cards")
            target.write("]}\n")
        os.replace(temporary_path, output_path)
    except Exception:
        temporary_path.unlink(missing_ok=True)
        raise
    return count


def build_snapshot(output_path: Path, *, bulk_type: str = "default_cards",
                   manifest_url: str = API_BULK_DATA) -> int:
    manifest = request_json(manifest_url)
    entry = find_bulk_entry(manifest, bulk_type)
    with tempfile.TemporaryDirectory(prefix="commander-pocket-scryfall-") as directory:
        download_path = Path(directory) / "bulk.json"
        request = urllib.request.Request(
            entry["download_uri"], headers={"User-Agent": USER_AGENT, "Accept": "application/json"}
        )
        with urllib.request.urlopen(request, timeout=300) as response, download_path.open("wb") as target:
            while chunk := response.read(1024 * 1024):
                target.write(chunk)
        return write_snapshot(
            download_path, output_path, updated_at=entry["updated_at"],
            download_uri=entry["download_uri"], bulk_type=bulk_type
        )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", required=True, type=Path, help="Server catalog JSON output path")
    parser.add_argument("--bulk-type", default="default_cards", help="Scryfall bulk type (default: default_cards)")
    parser.add_argument("--manifest-url", default=API_BULK_DATA, help=argparse.SUPPRESS)
    args = parser.parse_args()
    count = build_snapshot(args.output, bulk_type=args.bulk_type, manifest_url=args.manifest_url)
    print(f"Wrote {count} Scryfall cards to {args.output}")


if __name__ == "__main__":
    main()
