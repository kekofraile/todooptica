from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path


SKIP_PREFIXES = (
    Path("blog/_gen_old"),
    Path("blog/_gen_v2"),
    Path("blog/archive"),
    Path("legacy_archive"),
    Path("node_modules"),
    Path(".git"),
    Path(".playwright"),
    Path(".vscode"),
    Path("output"),
    Path("tests"),
    Path("dist"),
)

EDITORIAL_BLOCKLIST = (
    ("pollinations-banner", re.compile(r"Pollinations\.AI free text APIs", re.I)),
    ("pollinations-kofi", re.compile(r"pollinations\.ai/redirect/kofi", re.I)),
    ("support-our-mission", re.compile(r"Support our\s+mission", re.I)),
    ("ai-self-reference", re.compile(r"\b(?:as an ai|como ia|como una ia)\b", re.I)),
)


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", default=".", help="Raiz a validar")
    return parser.parse_args()


def _should_skip(root: Path, file_path: Path) -> bool:
    rel = file_path.relative_to(root)
    return any(prefix == rel or prefix in rel.parents for prefix in SKIP_PREFIXES)


def _iter_html_files(root: Path) -> list[Path]:
    return sorted(
        file_path
        for file_path in root.rglob("*.html")
        if not _should_skip(root, file_path)
    )


def main() -> None:
    args = _parse_args()
    root = Path(args.root).resolve()
    failures: list[tuple[str, int, str, str]] = []

    for file_path in _iter_html_files(root):
        lines = file_path.read_text(encoding="utf-8", errors="ignore").splitlines()
        for line_number, line in enumerate(lines, start=1):
            for label, pattern in EDITORIAL_BLOCKLIST:
                if pattern.search(line):
                    failures.append(
                        (
                            file_path.relative_to(root).as_posix(),
                            line_number,
                            label,
                            line.strip(),
                        )
                    )

    if failures:
        print("Editorial-surface validation failed.")
        for file_path, line_number, label, excerpt in failures:
            print(f"- {file_path}:{line_number} [{label}] {excerpt}")
        print(f"Total: {len(failures)} blocked editorial residues.")
        sys.exit(1)

    print("OK: No blocked editorial residues found in public HTML.")


if __name__ == "__main__":
    main()
