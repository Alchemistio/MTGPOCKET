#!/usr/bin/env python3
"""Build a complete, line-addressable index for a Magic Comprehensive Rules TXT file.

Usage:
  python Rules_Engine/tools/build_rule_index.py
  python Rules_Engine/tools/build_rule_index.py --source Rules_Engine/source/MagicCompRules_20261106.txt

Only the Python standard library is required. The source text is never rewritten.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import re
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_SOURCE = ROOT / "source" / "MagicCompRules_20261106.txt"
OUT = ROOT / "index"
RULE_RE = re.compile(r"^(\d{3}\.\d+[a-z]?)\.?\s+(.+)$")
SECTION_RE = re.compile(r"^(\d{3})\.\s+(.+)$")
CHAPTER_RE = re.compile(r"^([1-9])\.\s+(.+)$")
TOKEN_RE = re.compile(r"[a-z][a-z'-]{2,}")
REFERENCE_RE = re.compile(r"\b\d{3}(?:\.\d+[a-z]?)?\b")
STOP = set("""
a an and are as at be been being before between but by can could did do does doing
during each either for from further had has have having he her here hers him his how
i if in into is it its itself may me more most must my neither no nor not of off on
once only or other our out over own same she should so some such than that the their
theirs them themselves then there these they this those through to too under until up
upon us very was we were what when where which while who whom why will with within
without would you your yours magic rule rules section example note notes see
""".split())


def words(value: str) -> list[str]:
    return [w for w in TOKEN_RE.findall(value.lower()) if w not in STOP]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE)
    args = parser.parse_args()
    source = args.source.resolve()
    raw = source.read_bytes()
    text = raw.decode("utf-8-sig")
    lines = text.splitlines()
    glossary_at = max(i for i, line in enumerate(lines) if line.strip() == "Glossary")
    body_start = next(i for i, line in enumerate(lines) if i > 150 and line.strip() == "1. Game Concepts")

    records: list[dict] = []
    rule_docs: list[dict] = []
    chapter = chapter_title = section_id = section_title = ""
    i = body_start
    while i < glossary_at:
        line = lines[i]
        chapter_match = CHAPTER_RE.match(line)
        if chapter_match:
            chapter, chapter_title = chapter_match.groups()
            records.append({
                "id": chapter, "kind": "chapter", "title": chapter_title,
                "chapter": chapter, "chapter_title": chapter_title,
                "line_start": i + 1, "line_end": i + 1,
            })
            i += 1
            continue
        section_match = SECTION_RE.match(line)
        if section_match:
            section_id, section_title = section_match.groups()
            records.append({
                "id": section_id, "kind": "section", "title": section_title,
                "chapter": chapter, "chapter_title": chapter_title,
                "section_id": section_id, "section_title": section_title,
                "line_start": i + 1, "line_end": i + 1,
            })
            i += 1
            continue
        rule_match = RULE_RE.match(line)
        if rule_match:
            end = i
            while end + 1 < glossary_at and lines[end + 1].strip():
                end += 1
            paragraph = " ".join(lines[i:end + 1])
            paragraph = re.sub(r"\s+", " ", paragraph).strip()
            item = {
                "id": rule_match.group(1), "kind": "rule",
                "chapter": chapter, "chapter_title": chapter_title,
                "section_id": section_id, "section_title": section_title,
                "line_start": i + 1, "line_end": end + 1,
                "paragraph": paragraph,
            }
            records.append(item)
            rule_docs.append(item)
            i = end + 1
            continue
        i += 1

    if len({r["id"] for r in rule_docs}) != len(rule_docs):
        raise SystemExit("Duplicate numbered rule IDs found.")
    if not rule_docs:
        raise SystemExit("No numbered rules found.")

    document_frequency: Counter[str] = Counter()
    for item in rule_docs:
        document_frequency.update(set(words(item["paragraph"] + " " + item["section_title"])))

    def keywords(value: str, section: str = "") -> list[str]:
        counts = Counter(words(value + " " + section))
        total = len(rule_docs)
        ranked = sorted(
            counts,
            key=lambda token: (
                -(counts[token] * (math.log((total + 1) / (document_frequency[token] + 1)) + 1)),
                token,
            ),
        )
        section_words = words(section)
        ordered = list(dict.fromkeys(section_words + ranked))
        return ordered[:8]

    source_name = source.name
    for item in records:
        if item["kind"] == "rule":
            kw = keywords(item["paragraph"], item["section_title"])
            item["summary"] = (
                "Thématique : " + ", ".join(kw[:4])
                + ". Consulter le paragraphe source pour les conditions et exceptions exactes."
            )
            item["keywords"] = kw
            item["related_rules"] = sorted(set(REFERENCE_RE.findall(item["paragraph"])) - {item["id"]})
            del item["paragraph"]
        else:
            item["summary"] = f"{'Chapitre' if item['kind'] == 'chapter' else 'Section'} : {item['title']}."
            item["keywords"] = keywords(item["title"], item.get("chapter_title", ""))
        item["source_file"] = f"../source/{source_name}"

    by_chapter: dict[str, list[dict]] = {}
    for item in records:
        by_chapter.setdefault(item["chapter"], []).append(item)
    OUT.mkdir(parents=True, exist_ok=True)
    for number, items in sorted(by_chapter.items(), key=lambda pair: int(pair[0])):
        path = OUT / f"rules_chapter_{number}.jsonl"
        path.write_text("".join(json.dumps(x, ensure_ascii=False) + "\n" for x in items), encoding="utf-8")

    glossary: list[dict] = []
    i = glossary_at + 1
    while i < len(lines):
        while i < len(lines) and not lines[i].strip():
            i += 1
        if i >= len(lines) or lines[i].strip() == "Credits":
            break
        start = i
        term = lines[i].strip()
        i += 1
        while i < len(lines) and lines[i].strip():
            i += 1
        end = i - 1
        glossary.append({
            "id": term, "term": term, "kind": "glossary",
            "summary": f"Terme du glossaire Magic : {term}. Voir la définition dans la source.",
            "keywords": keywords(term),
            "source_file": f"../source/{source_name}",
            "line_start": start + 1, "line_end": end + 1,
        })
    (OUT / "glossary_index.jsonl").write_text(
        "".join(json.dumps(x, ensure_ascii=False) + "\n" for x in glossary), encoding="utf-8"
    )

    chapters = sorted(by_chapter, key=int)
    manifest = {
        "schema_version": 1,
        "source_file": f"Rules_Engine/source/{source_name}",
        "source_sha256": hashlib.sha256(raw).hexdigest(),
        "source_line_count": len(lines),
        "counts": {
            "rules": len(rule_docs),
            "sections": sum(x["kind"] == "section" for x in records),
            "chapters": sum(x["kind"] == "chapter" for x in records),
            "glossary_terms": len(glossary),
        },
        "index_files": [
            {"path": f"Rules_Engine/index/rules_chapter_{n}.jsonl", "chapter": int(n), "records": len(by_chapter[n])}
            for n in chapters
        ] + [{"path": "Rules_Engine/index/glossary_index.jsonl", "records": len(glossary)}],
        "position_format": "1-based inclusive line_start/line_end in the UTF-8 source text.",
        "summary_policy": "Generated topical summaries and keywords are navigation aids, not authoritative rule text.",
    }
    (OUT / "index_manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    table = [
        "| Chapitre | Fichier JSONL | Entrées indexées |",
        "|---|---|---:|",
    ]
    chapter_names = {x["chapter"]: x["chapter_title"] for x in records if x["kind"] == "chapter"}
    for n in chapters:
        table.append(f"| {n}. {chapter_names[n]} | [rules_chapter_{n}.jsonl](rules_chapter_{n}.jsonl) | {len(by_chapter[n])} |")
    table += [
        "",
        f"Règles/sous-règles : **{len(rule_docs)}** ; sections : **{manifest['counts']['sections']}** ; chapitres : **{manifest['counts']['chapters']}** ; termes du glossaire : **{len(glossary)}**.",
        "",
        "Chaque entrée fournit un résumé thématique automatique, des mots-clés, et une position de paragraphe (lignes inclusives) dans le fichier source. Le texte source fait toujours autorité.",
        "",
        "Voir [glossaire](glossary_index.jsonl), [manifest](index_manifest.json) et [README](../README.md).",
    ]
    (OUT / "rules_index.md").write_text("\n".join(table) + "\n", encoding="utf-8")
    print(json.dumps(manifest["counts"], ensure_ascii=False))


if __name__ == "__main__":
    main()
