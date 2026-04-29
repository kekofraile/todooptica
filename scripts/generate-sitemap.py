from datetime import datetime, timezone
from pathlib import Path
import xml.etree.ElementTree as ET


ET.register_namespace("", "http://www.sitemaps.org/schemas/sitemap/0.9")


def _lastmod(file_path: Path) -> str:
    return datetime.fromtimestamp(file_path.stat().st_mtime, tz=timezone.utc).date().isoformat()


def main() -> None:
    root = Path(".")
    base = "https://www.todooptica.es"
    html_files = (
        list(root.glob("*.html"))
        + list((root / "blog").glob("*.html"))
        + list((root / "games").glob("*/index.html"))
    )

    urls = []
    for file_path in html_files:
        if file_path.parent.name == "blog":
            url = f"/blog/{file_path.name}"
            priority = "0.7"
        elif file_path.parent.parent.name == "games" and file_path.name == "index.html":
            url = f"/games/{file_path.parent.name}/"
            priority = "0.8"
        else:
            url = f"/{file_path.name}"
            priority = "0.8"

        if url == "/index.html":
            url = "/"
            priority = "1.0"
        if url == "/blog.html":
            priority = "0.8"

        urls.append((url, priority, _lastmod(file_path)))

    urls = sorted(set(urls), key=lambda item: (0 if item[0] == "/" else 1, item[0]))

    urlset = ET.Element("{http://www.sitemaps.org/schemas/sitemap/0.9}urlset")
    for path, priority, lastmod in urls:
        url = ET.SubElement(urlset, "{http://www.sitemaps.org/schemas/sitemap/0.9}url")
        ET.SubElement(url, "{http://www.sitemaps.org/schemas/sitemap/0.9}loc").text = (
            f"{base}{path}"
        )
        ET.SubElement(url, "{http://www.sitemaps.org/schemas/sitemap/0.9}lastmod").text = lastmod
        ET.SubElement(url, "{http://www.sitemaps.org/schemas/sitemap/0.9}priority").text = priority

    tree = ET.ElementTree(urlset)
    if hasattr(ET, "indent"):
        ET.indent(tree, space="  ")

    out = root / "sitemap.xml"
    tree.write(out, encoding="utf-8", xml_declaration=True)
    print(f"Wrote sitemap with {len(urls)} urls to {out}")


if __name__ == "__main__":
    main()
