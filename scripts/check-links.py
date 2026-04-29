import argparse
import re
import sys
from urllib.parse import urlparse
from pathlib import Path


SKIP_PREFIXES = (
    Path("blog/_gen_old"),
    Path("blog/_gen_v2"),
    Path("blog/archive"),
    Path("legacy_archive"),
    Path("drafts"),
    Path("node_modules"),
    Path(".git"),
    Path(".playwright"),
    Path("dist"),
)
DISALLOWED_PREFIXES = ("blog/_gen_old", "blog/_gen_v2", "blog/archive", "legacy_archive/")
ATTR_PATTERN = re.compile(r"""\b(?:src|href)\s*=\s*(['"])(.*?)\1""", re.I)
SRCSET_PATTERN = re.compile(r"""\bsrcset\s*=\s*(['"])(.*?)\1""", re.I)
EXTERNAL_PREFIXES = (
    "http://",
    "https://",
    "//",
    "mailto:",
    "tel:",
    "#",
    "data:",
    "javascript:",
)


def _should_skip(root: Path, file_path: Path) -> bool:
    rel = file_path.relative_to(root)
    return any(prefix == rel or prefix in rel.parents for prefix in SKIP_PREFIXES)


def _iter_html_files(root: Path) -> list[Path]:
    return sorted(
        file_path
        for file_path in root.rglob("*.html")
        if not _should_skip(root, file_path)
    )


def _resolve(root: Path, base_file: Path, ref: str) -> Path:
    ref = ref.split("#")[0].split("?")[0].strip()
    if ref.startswith("/"):
        return (root / ref.lstrip("/")).resolve()
    return (base_file.parent / ref).resolve()


def _iter_refs(text: str):
    for match in ATTR_PATTERN.finditer(text):
        yield match.group(2).strip()

    for match in SRCSET_PATTERN.finditer(text):
        raw_value = match.group(2)
        for candidate in raw_value.split(","):
            ref = candidate.strip().split()[0]
            if ref:
                yield ref


def _is_disallowed_ref(root: Path, base_file: Path, ref: str) -> bool:
    ref = ref.split("?")[0].split("#")[0].strip()
    if ref.startswith(("http://", "https://")):
        parsed = urlparse(ref)
        if parsed.scheme and parsed.netloc:
            ref = parsed.path
        else:
            return False
    elif ref.startswith("//"):
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


def _parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", default=".", help="Raiz a validar")
    return parser.parse_args()


def main() -> None:
    args = _parse_args()
    root = Path(args.root).resolve()
    html_files = _iter_html_files(root)

    missing: list[tuple[str, str]] = []
    blocked: list[tuple[str, str]] = []

    for file_path in html_files:
        text = file_path.read_text(encoding="utf-8", errors="ignore")

        for ref in _iter_refs(text):
            if _is_disallowed_ref(root, file_path, ref):
                blocked.append((str(file_path.relative_to(root)), ref))

            if not ref or ref.startswith(EXTERNAL_PREFIXES):
                continue

            target = _resolve(root, file_path, ref)
            if not target.exists():
                missing.append((str(file_path.relative_to(root)), ref))

    if blocked:
        print("Disallowed legacy references detected:")
        for file_path, ref in blocked:
            print(f"- {file_path} -> {ref}")
        print(f"Total: {len(blocked)} disallowed references.")
        sys.exit(1)

    if missing:
        print(f"Missing local references: {len(missing)}")
        for file_path, ref in missing[:80]:
            print(f"- {file_path} -> {ref}")
        sys.exit(1)

    print(f"OK: {len(html_files)} HTML files checked. No missing local references.")


if __name__ == "__main__":
    main()
