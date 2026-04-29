import json
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from email.utils import format_datetime
from pathlib import Path


def _resolve_file(root: Path, url: str) -> Path:
    if url == "/":
        return root / "index.html"
    return root / url.lstrip("/")


def _published_at(root: Path, item: dict[str, str]) -> datetime:
    file_path = _resolve_file(root, item.get("url", ""))
    if file_path.exists():
        return datetime.fromtimestamp(file_path.stat().st_mtime, tz=timezone.utc)
    return datetime.now(timezone.utc)


def main() -> None:
    root = Path(".")
    base = "https://www.todooptica.es"

    index = json.loads((root / "search-index.json").read_text(encoding="utf-8"))
    posts = [item for item in index if item.get("kind") == "post"]
    post_dates = {item.get("url", ""): _published_at(root, item) for item in posts}
    last_build = max(post_dates.values(), default=datetime.now(timezone.utc))

    rss = ET.Element("rss", version="2.0")
    channel = ET.SubElement(rss, "channel")
    ET.SubElement(channel, "title").text = "Blog Todo Óptica"
    ET.SubElement(channel, "link").text = f"{base}/blog.html"
    ET.SubElement(
        channel,
        "description",
    ).text = (
        "Consejos de salud visual y auditiva, miopía infantil, lentillas y audiología."
    )
    ET.SubElement(channel, "language").text = "es-es"
    ET.SubElement(channel, "lastBuildDate").text = format_datetime(last_build)

    for item in posts:
        link = f"{base}{item['url']}"
        entry = ET.SubElement(channel, "item")
        ET.SubElement(entry, "title").text = item.get("title", "")
        ET.SubElement(entry, "link").text = link
        guid = ET.SubElement(entry, "guid", isPermaLink="true")
        guid.text = link
        ET.SubElement(entry, "description").text = item.get("description", "")
        ET.SubElement(entry, "pubDate").text = format_datetime(
            post_dates[item.get("url", "")]
        )

    tree = ET.ElementTree(rss)
    if hasattr(ET, "indent"):
        ET.indent(tree, space="  ")

    out = root / "rss.xml"
    tree.write(out, encoding="utf-8", xml_declaration=True)
    print(f"Wrote RSS feed with {len(posts)} items to {out}")


if __name__ == "__main__":
    main()
