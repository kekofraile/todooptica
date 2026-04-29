import json
import re
from pathlib import Path


def _read(path: Path) -> str:
  return path.read_text(encoding="utf-8", errors="ignore")


def _extract_title(html: str, fallback: str) -> str:
  m = re.search(r"<title>(.*?)</title>", html, re.I | re.S)
  if not m:
    return fallback
  return re.sub(r"\s+", " ", m.group(1)).strip()


def _extract_description(html: str) -> str:
  m = re.search(r'<meta\s+name="description"\s+content="([^"]*)"', html, re.I)
  return (m.group(1).strip() if m else "").strip()


def _extract_post_tag(html: str) -> str:
  m = re.search(r'<p class="post-meta">([^<]+)</p>', html)
  if not m:
    return ""
  parts = [p.strip() for p in m.group(1).split("·")]
  if len(parts) < 3:
    return ""
  return parts[-1]


def main() -> None:
  root = Path(".")
  html_files = list(root.glob("*.html")) + list((root / "blog").glob("*.html")) + list((root / "games").glob("*/index.html"))

  items = []
  for f in html_files:
    html = _read(f)
    title = _extract_title(html, f.name)
    desc = _extract_description(html)

    if f.parent.name == "blog":
      url = f"/blog/{f.name}"
      kind = "post"
      tag = _extract_post_tag(html)
    elif f.parent.parent.name == "games" and f.name == "index.html":
      url = f"/games/{f.parent.name}/"
      kind = "page"
      tag = "juego"
    else:
      url = f"/{f.name}"
      kind = "page"
      tag = ""

    items.append({"title": title, "description": desc, "url": url, "kind": kind, "tag": tag})

  # Pages first, then posts, then alphabetical.
  items.sort(key=lambda x: (0 if x["kind"] == "page" else 1, x["title"].lower()))

  out = root / "search-index.json"
  out.write_text(json.dumps(items, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
  print(f"Wrote {len(items)} items to {out}")


if __name__ == "__main__":
  main()
