"""Read-only image candidate finder for the ScholarClone client deck (Slice 2a).
Run:  python -I scripts/client-presentation/find-image-candidates.py
Queries the Wikimedia Commons API for METADATA ONLY (title, page URL, licence, author, size). It downloads no image and writes
docs/client-presentation/assets/candidates.json. Nothing here is "authorised": the owner picks from the list.
Licence policy proposed: accept CC0, public domain, CC BY; set aside CC BY-SA (share-alike) for the owner to decide; refuse NC / ND / unknown.
"""
import html
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

API = "https://commons.wikimedia.org/w/api.php"
UA = "ScholarCloneDeckResearch/0.1 (read-only licence metadata; contact: owner)"
OUT = Path(__file__).resolve().parents[2] / "docs" / "client-presentation" / "assets"
OUT.mkdir(parents=True, exist_ok=True)

SLOTS = {
    "img-hook": ["classroom India school students", "Indian school classroom students teacher"],
    "img-principal": ["school principal India office", "headmaster India school desk"],
    "img-student": ["student writing notebook India school", "schoolgirl writing India classroom"],
    "img-teacher": ["teacher students India classroom", "teacher helping students India school"],
    "img-staffroom": ["teachers India school staff room", "teacher India school corridor"],
    "img-counsel": ["student counselling India school", "career counselling India students"],
    "img-arrival": ["students arriving school India morning", "school gate India morning students"],
    "open-A-corridor": ["school corridor India", "school corridor classrooms India"],
    "open-C-campus": ["school campus India evening", "school building India dusk"],
}
GOOD = re.compile(r"^(CC0|Public domain|PD|CC BY (\d|\d\.\d))", re.I)
SA = re.compile(r"CC BY-SA", re.I)


def get(params):
    req = urllib.request.Request(API + "?" + urllib.parse.urlencode(params), headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)


def clean(v):
    return html.unescape(re.sub(r"<[^>]+>", "", v or "")).strip()


def search(q):
    d = get({
        "action": "query", "format": "json", "generator": "search", "gsrnamespace": 6,
        "gsrsearch": "filetype:bitmap " + q, "gsrlimit": 30, "prop": "imageinfo",
        "iiprop": "url|size|mime|timestamp|extmetadata",
        "iiextmetadatafilter": "LicenseShortName|LicenseUrl|Artist|Credit|AttributionRequired|Restrictions|ImageDescription|DateTimeOriginal",
    })
    out = []
    for p in (d.get("query", {}).get("pages", {}) or {}).values():
        ii = (p.get("imageinfo") or [{}])[0]
        m = ii.get("extmetadata", {})
        g = lambda k: clean((m.get(k) or {}).get("value", ""))
        out.append({
            "title": p["title"], "page": ii.get("descriptionurl"), "file": ii.get("url"),
            "w": ii.get("width"), "h": ii.get("height"), "mime": ii.get("mime"),
            "licence": g("LicenseShortName"), "licence_url": g("LicenseUrl"), "author": g("Artist")[:120],
            "credit": g("Credit")[:160], "attribution_required": g("AttributionRequired"), "restrictions": g("Restrictions"),
            "description": g("ImageDescription")[:160], "taken": g("DateTimeOriginal")[:30],
        })
    return out


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    result = {}
    for slot, queries in SLOTS.items():
        seen, good, sa, refused = set(), [], [], 0
        for q in queries:
            try:
                rows = search(q)
            except Exception as e:  # keep going; report at the end
                print(f"  ! {slot}: query failed ({str(e)[:60]})")
                continue
            for r in rows:
                if r["title"] in seen or (r["w"] or 0) < 2400 or (r["h"] or 0) < 1200 or r["mime"] not in ("image/jpeg", "image/png"):
                    continue
                seen.add(r["title"])
                if r["restrictions"]:
                    r["flag"] = "restrictions: " + r["restrictions"]
                if GOOD.match(r["licence"]):
                    good.append(r)
                elif SA.search(r["licence"]):
                    sa.append(r)
                else:
                    refused += 1
            time.sleep(1.0)
        result[slot] = {"accept_policy": good[:8], "share_alike_owner_decides": sa[:5], "refused_other_licence_count": refused}
        print(f"{slot:16} ok-licence {len(good):2}  share-alike {len(sa):2}  refused {refused}")
    (OUT / "candidates.json").write_text(json.dumps(result, indent=1, ensure_ascii=False), encoding="utf-8")
    print("wrote", OUT / "candidates.json")


if __name__ == "__main__":
    main()
