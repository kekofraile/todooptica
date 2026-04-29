from __future__ import annotations

import argparse
import re
import sys
from urllib.parse import urlparse
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(".").resolve()

SKIP_PREFIXES = (
    Path("blog/_gen_old"),
    Path("blog/_gen_v2"),
    Path("blog/archive"),
    Path("legacy_archive"),
    Path("drafts"),
    Path("node_modules"),
    Path(".git"),
    Path(".playwright"),
    Path(".vscode"),
    Path("output"),
    Path("tests"),
    Path("dist"),
)
DISALLOWED_PREFIXES = ("blog/_gen_old", "blog/_gen_v2", "blog/archive", "legacy_archive/")
EXTERNAL_PREFIXES = (
    "http://",
    "https://",
    "//",
    "mailto:",
    "tel:",
    "data:",
    "javascript:",
    "#",
)
ATTR_PATTERN = re.compile(r"""\b(?:src|href|action|srcset|link|data-url)\s*=\s*(['"])(.*?)\1""", re.I)
SRCSET_PATTERN = re.compile(r"""\bsrcset\s*=\s*(['"])(.*?)\1""", re.I)
XML_REF_TAGS = {"loc", "link", "url"}


def _should_skip(root: Path, file_path: Path) -> bool:
    rel = file_path.relative_to(root)
    return any(prefix == rel or prefix in rel.parents for prefix in SKIP_PREFIXES)


def _iter_html_files(root: Path) -> list[Path]:
    files = [file_path for file_path in root.rglob("*.html") if not _should_skip(root, file_path)]
    sitemap = root / "sitemap.xml"
    if sitemap.is_file():
        files.append(sitemap)
    rss = root / "rss.xml"
    if rss.is_file():
        files.append(rss)
    return sorted(set(files))


def _iter_refs(text: str):
    for match in ATTR_PATTERN.finditer(text):
        yield match.group(2).strip()

    for match in SRCSET_PATTERN.finditer(text):
        raw_value = match.group(2)
        for candidate in raw_value.split(","):
            ref = candidate.strip().split()[0]
            if ref:
                yield ref


def _iter_xml_links(file_path: Path):
    try:
        root = ET.parse(file_path).getroot()
    except ET.ParseError:
        return

    for element in root.iter():
        tag_name = element.tag.rsplit("}", 1)[-1]
        if tag_name not in XML_REF_TAGS:
            continue
        value = (element.text or "").strip()
        if value:
            yield value


def _is_disallowed(root: Path, base_file: Path, ref: str) -> bool:
    ref = ref.split("#")[0].split("?")[0].strip()
    if ref.startswith(("http://", "https://")):
        parsed = urlparse(ref)
        if parsed.scheme and parsed.netloc:
            ref = parsed.path
        else:
            return False
    elif ref.startswith(("//")):
        return False
    if not ref or ref.startswith(EXTERNAL_PREFIXES):
        return False

    try:
        if ref.startswith("/"):
            candidate = (root / ref.lstrip("/")).resolve()
        else:
            candidate = (base_file.parent / ref).resolve()
    except OSError:
        return False

    try:
        rel = candidate.relative_to(root).as_posix()
    except ValueError:
        return False

    return any(rel == p or rel.startswith(f"{p}/") for p in DISALLOWED_PREFIXES)


def _is_legacy_ref_text(ref: str) -> bool:
    ref = ref.split("#")[0].split("?")[0].strip().lstrip("/")
    if not ref:
        return False
    return any(ref == p or ref.startswith(f"{p}/") for p in DISALLOWED_PREFIXES)


def _parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", default=".", help="Raiz a validar")
    return parser.parse_args()


def main() -> None:
    args = _parse_args()
    root = Path(args.root).resolve()
    bad: list[tuple[str, str]] = []

    for file_path in _iter_html_files(root):
        text = file_path.read_text(encoding="utf-8", errors="ignore")
        refs: list[str] = list(_iter_refs(text))
        if file_path.name in ("sitemap.xml", "rss.xml"):
            refs.extend(_iter_xml_links(file_path))

        for ref in refs:
            if _is_legacy_ref_text(ref) or _is_disallowed(root, file_path, ref):
                bad.append((file_path.relative_to(root).as_posix(), ref))

    if bad:
        print("Public-surface validation failed: legacy paths found.")
        for file_path, ref in bad:
            print(f"- {file_path}: {ref}")
        print(f"Total: {len(bad)} references.")
        sys.exit(1)

    print("OK: Public surface does not reference legacy directories.")


if __name__ == "__main__":
    main()
