#!/usr/bin/env python3
"""
Turn the Excel price list into clean data for the website.

    python3 tools/extract_price_list.py data/Crackers_order_form.xlsx

Writes (relative to the project root):
    data/categories.json     categories in sheet order
    data/products.json       one entry per product, categories linked by slug
    data/import-report.txt   things to double-check (merged duplicates, odd units...)
    client/assets/products/  one optimized .webp per picture (max 480px)

Needs:  pip install openpyxl pillow lxml
Then load the JSON into MongoDB with:  npm run import-products   (inside server/)
"""
import argparse
import io
import json
import re
import sys
import zipfile
from collections import Counter, OrderedDict
from pathlib import Path

import openpyxl
from lxml import etree
from PIL import Image

NS = {
    "m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
    "x": "http://schemas.microsoft.com/office/spreadsheetml/2017/richdata",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
}
UNIT_LABELS = {
    "box": "Box", "boxes": "Box", "pkt": "Packet", "packet": "Packet", "pack": "Pack",
    "bundle": "Bundle", "set": "Set", "pcs": "Piece", "pc": "Piece",
    "piece": "Piece", "pieces": "Piece",
}
IMG_MAX = 480  # px, longest side


def slugify(text):  # same rules as server/src/utils/slugify.js
    text = text.lower().replace("&", " and ")
    text = re.sub(r"['’`]", "", text)
    return re.sub(r"[^a-z0-9]+", "-", text).strip("-")


def clean_spaces(s):
    return re.sub(r"\s+", " ", str(s)).strip()


def clean_category(name):
    # "03. Flower Pots Premium Series" / "06.Exclusive and New Launches" -> without the number
    return clean_spaces(re.sub(r"^\s*\d+\s*[.)]?\s*", "", name))


def parse_unit(raw):
    """'1 Box' -> (1, 'Box'),  '3 Box' -> (3, 'Box'),  '1 Pcs' -> (1, 'Piece')."""
    m = re.match(r"^\s*(\d+)\s*(.*?)\s*$", str(raw))
    count, label = (int(m.group(1)), m.group(2)) if m else (1, str(raw).strip())
    return count, UNIT_LABELS.get(label.lower(), label.title() or "Box")


def unit_text(count, label):
    return label if count == 1 else f"{count} {label}"


# ---------------------------------------------------------------- images in cells
def image_map(z):
    """Map sheet row -> media file name, for pictures placed inside column B cells."""
    meta = etree.fromstring(z.read("xl/metadata.xml"))
    future = [int(e.get("i")) for e in meta.xpath('//m:futureMetadata[@name="XLRICHVALUE"]/m:bk//x:rvb', namespaces=NS)]
    value_meta = [int(e.get("v")) for e in meta.xpath("//m:valueMetadata/m:bk/m:rc", namespaces=NS)]
    rich = etree.fromstring(z.read("xl/richData/rdrichvalue.xml"))
    rich_values = [[int(v.text) for v in rv.findall("{%s}v" % NS["x"])] for rv in rich]
    rel_ids = [e.get("{%s}id" % NS["r"]) for e in etree.fromstring(z.read("xl/richData/richValueRel.xml"))]
    targets = {e.get("Id"): e.get("Target") for e in etree.fromstring(z.read("xl/richData/_rels/richValueRel.xml.rels"))}

    sheet = z.read("xl/worksheets/sheet1.xml").decode("utf8")
    rows = {}
    for row, vm in re.findall(r'<c r="B(\d+)"[^>]*? vm="(\d+)"', sheet):
        rv = rich_values[future[value_meta[int(vm) - 1]]]
        rows[int(row)] = "xl/" + targets[rel_ids[rv[0]]].replace("../", "")
    return rows


def save_webp(data, path):
    img = Image.open(io.BytesIO(data))
    if img.mode in ("RGBA", "LA", "P"):
        img = img.convert("RGBA")
        bg = Image.new("RGB", img.size, (255, 255, 255))
        bg.paste(img, mask=img.split()[-1])
        img = bg
    else:
        img = img.convert("RGB")
    img.thumbnail((IMG_MAX, IMG_MAX), Image.LANCZOS)
    img.save(path, "WEBP", quality=80, method=6)


# ---------------------------------------------------------------- main
def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("xlsx")
    ap.add_argument("--root", default=str(Path(__file__).resolve().parent.parent), help="project root")
    ap.add_argument("--web-prefix", default="/assets/products", help="URL prefix stored in product.image")
    args = ap.parse_args()

    root = Path(args.root)
    data_dir, img_dir = root / "data", root / "client" / "assets" / "products"
    data_dir.mkdir(parents=True, exist_ok=True)
    img_dir.mkdir(parents=True, exist_ok=True)

    z = zipfile.ZipFile(args.xlsx)
    row_media = image_map(z)

    ws = openpyxl.load_workbook(args.xlsx, read_only=True).active
    all_rows = list(ws.iter_rows(values_only=True))

    header = next((i for i, r in enumerate(all_rows) if r and len(r) > 2 and str(r[2] or "").strip().lower() == "product name"), None)
    if header is None:
        sys.exit("Could not find the 'Product Name' header row in column C.")

    categories, raw = OrderedDict(), []
    cur, warnings = None, []
    for idx in range(header + 1, len(all_rows)):
        r = all_rows[idx] + (None,) * 6
        a, c, d, e = r[0], r[2], r[3], r[4]
        row_no = idx + 1
        if isinstance(a, str) and a.strip() and c is None and e is None:
            name = clean_category(a)
            cur = slugify(name)
            categories.setdefault(cur, {"name": name, "slug": cur, "sortOrder": len(categories) + 1})
        elif c and e is not None:
            if not isinstance(e, (int, float)):
                warnings.append(f"Row {row_no}: price '{e}' is not a number, skipped ({clean_spaces(c)})")
                continue
            if cur is None:
                warnings.append(f"Row {row_no}: product before any category, skipped ({clean_spaces(c)})")
                continue
            raw.append({"row": row_no, "name": clean_spaces(c), "category": cur, "unit": parse_unit(d or "1 Box"),
                        "price": round(float(e), 2), "media": row_media.get(row_no)})

    # ---- merge repeated products (same name + price), keeping every category
    groups, report = OrderedDict(), {"merged": [], "unit_conflicts": [], "price_conflicts": []}
    for p in raw:
        key = p["name"].lower()
        g = groups.get(key)
        if g and abs(g["price"] - p["price"]) > 0.005:  # same name, different price: keep both
            report["price_conflicts"].append(f"{p['name']}: {g['price']} vs {p['price']} (kept as two products)")
            key = f"{key}|{p['price']}"
            g = groups.get(key)
        if not g:
            groups[key] = {**p, "categories": [p["category"]], "rows": [p["row"]]}
            continue
        g["rows"].append(p["row"])
        if p["category"] not in g["categories"]:
            g["categories"].append(p["category"])
        g["media"] = g["media"] or p["media"]
        if p["unit"] != g["unit"]:
            keep = p["unit"] if (g["unit"][0] > 1 and p["unit"][0] == 1) else g["unit"]
            msg = f"{g['name']}: {unit_text(*g['unit'])} vs {unit_text(*p['unit'])} -> using {unit_text(*keep)}"
            if msg not in report["unit_conflicts"]:
                report["unit_conflicts"].append(msg)
            g["unit"] = keep

    # ---- slugs, images
    products, used_slugs, media_file = [], Counter(), {}
    for sort, g in enumerate(groups.values(), start=1):
        base = slugify(g["name"])
        used_slugs[base] += 1
        slug = base if used_slugs[base] == 1 else f"{base}-{used_slugs[base]}"
        image = ""
        if g["media"]:
            if g["media"] not in media_file:
                save_webp(z.read(g["media"]), img_dir / f"{slug}.webp")
                media_file[g["media"]] = f"{args.web_prefix}/{slug}.webp"
            image = media_file[g["media"]]
        products.append({
            "name": g["name"], "slug": slug, "categories": g["categories"], "price": g["price"],
            "unit": unit_text(*g["unit"]), "image": image,
            "isGiftBox": any("gift box" in categories[c]["name"].lower() for c in g["categories"]),
            "sortOrder": sort,
        })
        if len(g["rows"]) > 1:
            report["merged"].append(f"{g['name']}  ({len(g['rows'])} rows -> {len(g['categories'])} categories)")

    (data_dir / "categories.json").write_text(json.dumps(list(categories.values()), indent=2, ensure_ascii=False), encoding="utf8")
    (data_dir / "products.json").write_text(json.dumps(products, indent=2, ensure_ascii=False), encoding="utf8")

    # ---- report
    lines = [f"Source rows: {len(raw)}   Products after merging repeats: {len(products)}   Categories: {len(categories)}",
             f"Pictures written: {len(media_file)} (max {IMG_MAX}px, WebP)", ""]
    def section(title, items, note=""):
        lines.append(f"## {title} ({len(items)})" + (f" - {note}" if note else ""))
        lines.extend(f"  - {i}" for i in items) if items else lines.append("  none")
        lines.append("")
    section("Please confirm with the owner: packs priced for more than one unit",
            [f"{p['name']}: price {p['price']:g} is per '{p['unit']}'" for p in products if p["unit"][0].isdigit()],
            "stored exactly as written in the sheet")
    section("Same product, different unit text in two places", report["unit_conflicts"])
    section("Same product, different price (kept separate)", report["price_conflicts"])
    section("Prices that are not whole rupees", [f"{p['name']}: {p['price']}" for p in products if p["price"] != int(p["price"])])
    section("Products with no picture in the sheet", [p["name"] for p in products if not p["image"]], "shown with a letter placeholder")
    section("Repeated products merged into one (listed under every category they appeared in)", report["merged"])
    section("Warnings", warnings)
    (data_dir / "import-report.txt").write_text("\n".join(lines), encoding="utf8")
    print("\n".join(lines[:2]))
    print(f"Wrote data/categories.json, data/products.json, data/import-report.txt and {len(media_file)} images")


if __name__ == "__main__":
    main()
