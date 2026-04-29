import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(".").resolve()
DIST = ROOT / "dist"
BLACKLIST_PREFIXES = ("blog/_gen_old", "blog/_gen_v2", "blog/archive", "legacy_archive/")
PUBLIC_DIRS = ("assets", "vendor", "blog", "games")
PUBLIC_EXTENSIONS = {
    ".css",
    ".html",
    ".ico",
    ".js",
    ".json",
    ".map",
    ".mp4",
    ".pdf",
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".webp",
    ".svg",
    ".txt",
    ".xml",
    ".woff",
    ".woff2",
    ".ttf",
    ".otf",
}
EXCLUDED_SUBPATHS = {
    Path("games/lumen-optical-store-rush/app"),
}
ROOT_EXCLUDED_FILES = {
    "node_modules",
    "package-lock.json",
    "package.json",
    "playwright.config.js",
    "progress.md",
}


def _run(cmd: list[str]) -> None:
    result = subprocess.run(cmd, check=False)
    if result.returncode != 0:
        sys.exit(result.returncode)


def _is_blacklisted(path: Path) -> bool:
    rel = path.resolve().as_posix()
    return any(prefix in rel for prefix in BLACKLIST_PREFIXES)


def _clean_dist() -> None:
    if DIST.exists():
        shutil.rmtree(DIST)
    DIST.mkdir(parents=True, exist_ok=True)


def _is_excluded(root: Path, path: Path) -> bool:
    try:
        rel = path.relative_to(root)
    except ValueError:
        return False
    return any(prefix == rel or prefix in rel.parents for prefix in EXCLUDED_SUBPATHS)


def _iter_root_files() -> list[tuple[Path, Path]]:
    files: list[tuple[Path, Path]] = []
    for item in ROOT.iterdir():
        if item.name.startswith(".") or item == DIST or not item.is_file():
            continue
        if item.name in ROOT_EXCLUDED_FILES:
            continue
        if item.suffix.lower() not in PUBLIC_EXTENSIONS:
            continue
        if item.suffix.lower() == ".json" and item.name != "search-index.json":
            continue
        target = DIST / item.name
        files.append((item, target))
    return files


def _prepare_publish() -> None:
    selected: list[tuple[Path, Path]] = []
    for source, destination in _iter_root_files():
        if _is_blacklisted(source):
            print(f"Refusing to publish legacy path: {source}")
            sys.exit(1)
        if _is_excluded(ROOT, source):
            continue
        selected.append((source, destination))

    for name in PUBLIC_DIRS:
        source = ROOT / name
        if source.exists() and source.is_dir():
            if _is_blacklisted(source):
                print(f"Refusing to publish legacy path: {source}")
                sys.exit(1)
            for item in sorted(source.rglob("*")):
                if item.is_dir():
                    continue
                if item.is_symlink():
                    continue
                if _is_excluded(ROOT, item):
                    continue
                if item.name.startswith("."):
                    continue
                if item.suffix.lower() not in PUBLIC_EXTENSIONS:
                    continue
                destination = DIST / item.relative_to(ROOT)
                selected.append((item, destination))

    if not selected:
        print("No public assets selected. Refusing to publish.")
        sys.exit(1)

    for source, destination in selected:
        if _is_blacklisted(source):
            print(f"Refusing to publish legacy path: {source}")
            sys.exit(1)
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, destination)


def main() -> None:
    _run(["npm", "run", "build:store-rush"])
    # Ensure indices and SEO artifacts are regenerated before publish.
    _run(["npm", "run", "generate:seo"])
    # Validate the source tree before building the publication snapshot.
    _run(["python3", "scripts/check-links.py", "--root", "."])
    _run(["python3", "scripts/validate-public-surface.py", "--root", "."])
    _run(["python3", "scripts/validate-editorial-surface.py", "--root", "."])

    _clean_dist()
    _prepare_publish()
    # Validate the generated public surface independently from source.
    _run(["python3", "scripts/check-links.py", "--root", "dist"])
    _run(["python3", "scripts/validate-public-surface.py", "--root", "dist"])
    _run(["python3", "scripts/validate-editorial-surface.py", "--root", "dist"])

    print(f"Publication snapshot created at {DIST}")


if __name__ == "__main__":
    main()
