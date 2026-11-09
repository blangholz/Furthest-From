"""Download McDonald's locations for the US, Canada and Mexico from All the Places (CC0).

Writes data/atp/mcdonalds_us_ca_mx.csv and data/atp/source.json.
If the US spider output is missing or looks too small, the US rows fall back to the
older data/us_mcdonalds.csv and source.json says so.
"""
import csv
import io
import json
import sys
import time
import re
import urllib.error
import urllib.request
import zipfile
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "data" / "atp"
FALLBACK_US = ROOT / "data" / "us_mcdonalds.csv"
HOSTS = ["https://alltheplaces-data.openaddresses.io", "https://data.alltheplaces.xyz"]
WIKIDATA = "Q38076"  # McDonald's (McCafé rows use another id and are dropped)
MIN_US = 12000  # a healthy US run has roughly 13,000+ stores
# spider name -> countries we keep from it
SPIDERS = {"mcdonalds_us": {"US"}, "mcdonalds": {"CA"}, "mcdonalds_latin_america": {"MX"}}
UA = {"User-Agent": "furthest-from-data-refresh (GitHub Actions)"}


def get(url, timeout=300):
    last = None
    for attempt in range(3):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.read(), r.geturl()
        except urllib.error.HTTPError as e:
            if e.code in (403, 404):
                raise
            last = e
        except Exception as e:  # noqa: BLE001
            last = e
        time.sleep(5 * (attempt + 1))
    raise last


def parse_features(raw):
    text = raw.decode("utf-8", "replace").strip()
    if not text:
        return []
    if text.startswith("{") and '"features"' in text[:2000]:
        try:
            return json.loads(text).get("features", [])
        except json.JSONDecodeError:
            pass
    feats = []
    for line in text.splitlines():
        line = line.strip().rstrip(",")
        if line.startswith("{"):
            try:
                feats.append(json.loads(line))
            except json.JSONDecodeError:
                continue
    return feats


def fetch_spider(name):
    """Return (features, url) for one spider's latest output, or ([], None)."""
    for host in HOSTS:
        url = f"{host}/runs/latest/output/{name}.geojson"
        try:
            raw, final = get(url)
            feats = parse_features(raw)
            if feats:
                return feats, final
            print(f"  {url}: no features", file=sys.stderr)
        except Exception as e:  # noqa: BLE001
            print(f"  {url}: {e}", file=sys.stderr)
    # Fallback: find the spider inside the per-group zips listed in latest.json
    for host in HOSTS:
        try:
            raw, _ = get(f"{host}/runs/latest.json", timeout=60)
            latest = json.loads(raw)
        except Exception as e:  # noqa: BLE001
            print(f"  {host}/runs/latest.json: {e}", file=sys.stderr)
            continue
        zips = [g.get("zip_url") for g in latest.get("groups", []) if g.get("zip_url")]
        if latest.get("output_url"):
            zips.append(latest["output_url"])
        for zurl in zips:
            try:
                raw, final = get(zurl, timeout=900)
                with zipfile.ZipFile(io.BytesIO(raw)) as z:
                    for member in z.namelist():
                        if member.rsplit("/", 1)[-1] == f"{name}.geojson":
                            feats = parse_features(z.read(member))
                            if feats:
                                return feats, f"{final}#{member}"
            except Exception as e:  # noqa: BLE001
                print(f"  {zurl}: {e}", file=sys.stderr)
        break
    return [], None


def past_run_ids(limit=16):
    """Newest-first run ids from All the Places' run history."""
    for host in HOSTS:
        try:
            raw, _ = get(f"{host}/runs/history.json", timeout=120)
        except Exception as e:  # noqa: BLE001
            print(f"  {host}/runs/history.json: {e}", file=sys.stderr)
            continue
        ids = sorted(set(re.findall(r"\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}", raw.decode("utf-8", "replace"))), reverse=True)
        return ids[:limit]
    return []


def fetch_us_from_history():
    """The latest run may lack the US spider; look back through recent runs for one that has it."""
    for rid in past_run_ids():
        for spider in ("mcdonalds_us", "mcdonalds"):
            for host in HOSTS:
                url = f"{host}/runs/{rid}/output/{spider}.geojson"
                try:
                    raw, final = get(url)
                except Exception:  # noqa: BLE001
                    continue
                got = rows_from(parse_features(raw), spider, {"US"})
                print(f"  {url}: {len(got)} US stores", file=sys.stderr)
                if len(got) >= MIN_US:
                    return got, final, rid
                break
    return [], None, None


def rows_from(feats, spider, keep):
    seen, rows = set(), []
    for f in feats:
        p = f.get("properties") or {}
        g = f.get("geometry") or {}
        if g.get("type") != "Point":
            continue
        if p.get("brand:wikidata") != WIKIDATA or str(p.get("ref", "")).endswith("-mccafe"):
            continue
        country = (p.get("addr:country") or "").upper()
        if country not in keep:
            continue
        ref = str(p.get("ref") or p.get("id") or "")
        if ref in seen:
            continue
        seen.add(ref)
        lon, lat = g["coordinates"][:2]
        rows.append(
            {
                "id": f"{spider}:{ref}",
                "lat": round(float(lat), 6),
                "lon": round(float(lon), 6),
                "address": p.get("addr:street_address") or p.get("addr:full") or "",
                "city": p.get("addr:city") or "",
                "state": p.get("addr:state") or "",
                "country": country,
                "source": "atp",
            }
        )
    return rows


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    info = {"fetched_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"), "spiders": {}, "notes": []}
    rows = []
    for spider, keep in SPIDERS.items():
        print(f"Fetching {spider}", file=sys.stderr)
        feats, url = fetch_spider(spider)
        got = rows_from(feats, spider, keep)
        counts = {c: sum(r["country"] == c for r in got) for c in sorted(keep)}
        info["spiders"][spider] = {"url": url, "features": len(feats), "kept": counts}
        print(f"  kept {counts}", file=sys.stderr)
        if spider == "mcdonalds_us" and counts.get("US", 0) < MIN_US:
            print("  latest run has no usable US file; checking earlier runs", file=sys.stderr)
            old_got, old_url, rid = fetch_us_from_history()
            if old_got:
                got = old_got
                info["spiders"][spider] = {"url": old_url, "features": len(old_got), "kept": {"US": len(old_got)}}
                info["notes"].append(f"Latest All the Places run had no usable US McDonald's file; used run {rid}.")
                rows.extend(got)
                continue
            info["notes"].append(
                f"All the Places US output had {counts.get('US', 0)} stores (< {MIN_US}); "
                "used the older data/us_mcdonalds.csv for US stores instead."
            )
            got = []
            with open(FALLBACK_US, newline="") as fh:
                for r in csv.DictReader(fh):
                    got.append(
                        {
                            "id": f"old:{r['id']}",
                            "lat": float(r["lat"]),
                            "lon": float(r["lon"]),
                            "address": r["address"],
                            "city": r["city"],
                            "state": r["state"],
                            "country": "US",
                            "source": f"old-{r['source']}",
                        }
                    )
        rows.extend(got)
    info["counts"] = {c: sum(r["country"] == c for r in rows) for c in ("US", "CA", "MX")}
    info["us_source"] = "old" if any(r["source"].startswith("old") for r in rows) else "atp"
    with open(OUT_DIR / "mcdonalds_us_ca_mx.csv", "w", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=["id", "lat", "lon", "address", "city", "state", "country", "source"])
        w.writeheader()
        w.writerows(sorted(rows, key=lambda r: (r["country"], r["state"], r["city"], r["id"])))
    (OUT_DIR / "source.json").write_text(json.dumps(info, indent=1) + "\n")
    print(json.dumps(info["counts"]), file=sys.stderr)
    if info["counts"]["US"] == 0:
        sys.exit("No US stores at all; stopping.")


if __name__ == "__main__":
    main()
