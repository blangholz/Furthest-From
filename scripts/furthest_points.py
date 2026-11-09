"""Find, for each US state and DC, the point furthest (straight line) from any McDonald's.

Method: the largest empty circle. Inside a state, the furthest point is either a
Voronoi vertex of the store set (a point equally far from 3 stores) or a point on the
state's edge. We test every Voronoi vertex inside the state plus the state's edge
sampled every ~100 m, measure with a KD-tree on the unit sphere, re-measure the best
candidates on the WGS84 ellipsoid, and cross-check against a coarse grid.

Rules agreed with Benjamin (2026-11-09):
- Any McDonald's counts, including Canada and Mexico.
- Alaska: mainland only. Hawaii: the 8 main islands only.
- Spots are kept about 100-200 m inside the state line / shoreline (polygon shrunk
  by 0.002 degrees), so no spot sits exactly on a border.
"""
import argparse
import csv
import json
import math
import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import shapely
from pyproj import Geod
from scipy.spatial import ConvexHull, cKDTree
from shapely.geometry import MultiPolygon, shape

GEOD = Geod(ellps="WGS84")
R_MI = 3958.7613  # mean Earth radius in miles (sphere, for search only)
M_PER_MI = 1609.344
INSET_DEG = 0.002
EDGE_STEP_DEG = 0.001
STATES = {
    "AL": "Alabama", "AK": "Alaska", "AZ": "Arizona", "AR": "Arkansas", "CA": "California",
    "CO": "Colorado", "CT": "Connecticut", "DE": "Delaware", "DC": "District of Columbia",
    "FL": "Florida", "GA": "Georgia", "HI": "Hawaii", "ID": "Idaho", "IL": "Illinois",
    "IN": "Indiana", "IA": "Iowa", "KS": "Kansas", "KY": "Kentucky", "LA": "Louisiana",
    "ME": "Maine", "MD": "Maryland", "MA": "Massachusetts", "MI": "Michigan", "MN": "Minnesota",
    "MS": "Mississippi", "MO": "Missouri", "MT": "Montana", "NE": "Nebraska", "NV": "Nevada",
    "NH": "New Hampshire", "NJ": "New Jersey", "NM": "New Mexico", "NY": "New York",
    "NC": "North Carolina", "ND": "North Dakota", "OH": "Ohio", "OK": "Oklahoma", "OR": "Oregon",
    "PA": "Pennsylvania", "RI": "Rhode Island", "SC": "South Carolina", "SD": "South Dakota",
    "TN": "Tennessee", "TX": "Texas", "UT": "Utah", "VT": "Vermont", "VA": "Virginia",
    "WA": "Washington", "WV": "West Virginia", "WI": "Wisconsin", "WY": "Wyoming",
}


def unit(lat, lon):
    la, lo = np.radians(np.asarray(lat, float)), np.radians(np.asarray(lon, float))
    return np.column_stack([np.cos(la) * np.cos(lo), np.cos(la) * np.sin(lo), np.sin(la)])


def chord_to_mi(d):
    return 2 * np.arcsin(np.clip(np.asarray(d) / 2, 0, 1)) * R_MI


def load_stores(path):
    with open(path, newline="") as fh:
        rows = list(csv.DictReader(fh))
    for r in rows:
        r["lat"], r["lon"] = float(r["lat"]), float(r["lon"])
        r.setdefault("country", "US")
        r["country"] = r.get("country") or "US"
    return rows


def load_states(path):
    """Census cartographic boundary zip (STUSPS) or Natural Earth admin-1 GeoJSON (postal)."""
    out = {}
    if str(path).endswith(".zip"):
        import shapefile  # pyshp

        with shapefile.Reader(str(path)) as rdr:
            names = [f[0] for f in rdr.fields[1:]]
            for sr in rdr.iterShapeRecords():
                rec = dict(zip(names, sr.record))
                code = rec.get("STUSPS")
                if code in STATES:
                    out[code] = shapely.make_valid(shape(sr.shape.__geo_interface__))
    else:
        fc = json.load(open(path))
        for f in fc["features"]:
            p = f["properties"]
            if p.get("adm0_a3") == "USA" and p.get("postal") in STATES:
                out[p["postal"]] = shapely.make_valid(shape(f["geometry"]))
    return out


def polys(geom):
    if geom.geom_type == "Polygon":
        return [geom]
    return [g for g in getattr(geom, "geoms", []) if g.geom_type == "Polygon"] + [
        p for g in getattr(geom, "geoms", []) if g.geom_type == "MultiPolygon" for p in g.geoms
    ]


def apply_island_rules(code, geom):
    parts = sorted(polys(geom), key=lambda p: p.area, reverse=True)
    if code == "AK":
        return MultiPolygon(parts[:1]), "Alaska mainland only"
    if code == "HI":
        main = [p for p in parts if p.centroid.x > -160.6][:8]
        return MultiPolygon(main), "Hawaii's 8 main islands only"
    return MultiPolygon(parts), ""


class Stores:
    def __init__(self, rows):
        self.rows = rows
        lat = np.array([r["lat"] for r in rows])
        lon = np.array([r["lon"] for r in rows])
        self.lat, self.lon = lat, lon
        xyz = unit(lat, lon)
        self.tree = cKDTree(xyz)
        uniq = np.unique(np.round(xyz, 8), axis=0)
        try:
            hull = ConvexHull(uniq)
        except Exception:  # noqa: BLE001
            hull = ConvexHull(uniq, qhull_options="QJ")
        n = hull.equations[:, :3]
        n = n / np.linalg.norm(n, axis=1)[:, None]
        self.vlat = np.degrees(np.arcsin(np.clip(n[:, 2], -1, 1)))
        self.vlon = np.degrees(np.arctan2(n[:, 1], n[:, 0]))

    def nearest_mi(self, lat, lon):
        d, i = self.tree.query(unit(lat, lon))
        return chord_to_mi(d), i

    def geodesic_nearest(self, lat, lon, k=8):
        """Ellipsoidal distance (mi) to the k sphere-nearest stores, sorted."""
        _, idx = self.tree.query(unit([lat], [lon]), k=min(k, len(self.rows)))
        idx = np.atleast_1d(idx[0])
        _, _, dist = GEOD.inv(np.full(len(idx), lon), np.full(len(idx), lat), self.lon[idx], self.lat[idx])
        order = np.argsort(dist)
        return dist[order] / M_PER_MI, idx[order]


def edge_samples(geom):
    pts = []
    for p in polys(geom):
        for ring in [p.exterior, *p.interiors]:
            c = np.asarray(shapely.segmentize(ring, EDGE_STEP_DEG).coords)
            pts.append(c)
    if not pts:
        return np.empty(0), np.empty(0)
    c = np.vstack(pts)
    return c[:, 1], c[:, 0]


def furthest_in(geom, stores):
    minx, miny, maxx, maxy = geom.bounds
    sel = (stores.vlon >= minx) & (stores.vlon <= maxx) & (stores.vlat >= miny) & (stores.vlat <= maxy)
    vlat, vlon = stores.vlat[sel], stores.vlon[sel]
    inside = shapely.contains_xy(geom, vlon, vlat) if len(vlat) else np.zeros(0, bool)
    elat, elon = edge_samples(geom)
    clat = np.concatenate([vlat[inside], elat])
    clon = np.concatenate([vlon[inside], elon])
    d, _ = stores.nearest_mi(clat, clon)
    top = np.argsort(-d)[:300]
    best = None
    for j in top:
        gd, gi = stores.geodesic_nearest(clat[j], clon[j])
        if best is None or gd[0] > best["miles"]:
            best = {"lat": float(clat[j]), "lon": float(clon[j]), "miles": float(gd[0]), "near": gi[:3], "near_mi": gd[:3]}
    # coarse grid cross-check (sphere)
    step = 0.05
    gx, gy = np.meshgrid(np.arange(minx, maxx, step), np.arange(miny, maxy, step))
    gx, gy = gx.ravel(), gy.ravel()
    m = shapely.contains_xy(geom, gx, gy)
    grid_max = float(stores.nearest_mi(gy[m], gx[m])[0].max()) if m.any() else 0.0
    best["grid_check_ok"] = bool(grid_max <= best["miles"] * 1.004 + 0.2)
    best["grid_max_mi"] = round(grid_max, 2)
    return best


def store_label(r):
    return f"{r.get('city', '').strip()}, {r.get('state', '').strip()}{'' if r['country'] == 'US' else ' (' + r['country'] + ')'}"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--stores", required=True)
    ap.add_argument("--boundaries", required=True)
    ap.add_argument("--compare", help="older store CSV to compare against (optional)")
    ap.add_argument("--source-info", help="source.json written by fetch_atp.py (optional)")
    ap.add_argument("--out", required=True)
    a = ap.parse_args()

    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    rows = load_stores(a.stores)
    stores = Stores(rows)
    old = Stores(load_stores(a.compare)) if a.compare else None
    states = load_states(a.boundaries)
    missing = sorted(set(STATES) - set(states))
    if missing:
        sys.exit(f"Boundary file is missing {missing}")
    src = json.load(open(a.source_info)) if a.source_info else {}

    results = []
    for code in sorted(states, key=lambda c: STATES[c]):
        full, rule = apply_island_rules(code, states[code])
        inner = shapely.make_valid(full.buffer(-INSET_DEG))
        if inner.is_empty:
            inner = full
        b = furthest_in(inner, stores)
        near = []
        for idx, mi in zip(b["near"], b["near_mi"]):
            r = rows[idx]
            item = {"miles": round(float(mi), 2), "place": store_label(r), "address": r.get("address", ""),
                    "country": r["country"], "lat": r["lat"], "lon": r["lon"], "source": r.get("source", "")}
            if old is not None:
                od, _ = old.geodesic_nearest(r["lat"], r["lon"], k=1)
                item["in_old_list"] = bool(od[0] < 0.3)
            near.append(item)
        flags = []
        if any(n["source"] in ("2022", "old-2022") for n in near):
            flags.append("pinned by a store only in the 2022 list (may have closed)")
        if old is not None:
            # stores the old list has inside this empty circle: if they still exist, the gap is smaller
            gd, gi = old.geodesic_nearest(b["lat"], b["lon"], k=10)
            inside = [(float(d), old.rows[i]) for d, i in zip(gd, gi) if d < b["miles"] - 0.3]
            if inside:
                flags.append(
                    "assumes these older-list stores are gone: "
                    + "; ".join(f"{store_label(r)} ({r.get('source', '')}, {d:.1f} mi)" for d, r in inside[:4])
                )
            if any(not n.get("in_old_list", True) for n in near):
                flags.append("pinned by a store missing from the older list (new or previously missed)")
            o = furthest_in(inner, old)
            old_mi, old_ll = round(o["miles"], 1), [round(o["lat"], 5), round(o["lon"], 5)]
        else:
            old_mi, old_ll = None, None
        if not b["grid_check_ok"]:
            flags.append(f"grid cross-check found {b['grid_max_mi']} mi; recheck")
        # which state lines / edges the spot is next to
        pt = shapely.Point(b["lon"], b["lat"])
        edge_m = full.boundary.distance(pt) * 111320 * math.cos(math.radians(b["lat"]))
        neighbors = sorted(c for c, g in states.items() if c != code and g.distance(pt) < 0.01)
        results.append({
            "state": code, "name": STATES[code], "lat": round(b["lat"], 5), "lon": round(b["lon"], 5),
            "miles": round(b["miles"], 1), "nearest": near, "rule": rule,
            "edge_m": round(edge_m), "next_to": neighbors, "flags": flags,
            "old_list_miles": old_mi, "old_list_spot": old_ll,
        })
        print(f"{code} {b['lat']:.5f},{b['lon']:.5f} {b['miles']:.1f} mi  {near[0]['place']}  {flags}", file=sys.stderr, flush=True)

    lower48 = max((r for r in results if r["state"] not in ("AK", "HI", "DC")), key=lambda r: r["miles"])
    meta = {
        "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "stores": {c: sum(r["country"] == c for r in rows) for c in ("US", "CA", "MX")},
        "store_source": src,
        "boundaries": Path(a.boundaries).name,
        "distance": "straight line on the WGS84 ellipsoid, miles",
        "national_lower48": {k: lower48[k] for k in ("state", "lat", "lon", "miles", "nearest", "flags")},
    }
    (out / "furthest_by_state.json").write_text(json.dumps({"meta": meta, "states": results}, indent=1) + "\n")
    with open(out / "furthest_by_state.csv", "w", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(["state", "name", "lat", "lon", "miles", "nearest_1", "nearest_1_mi", "nearest_2", "nearest_2_mi",
                    "nearest_3", "nearest_3_mi", "next_to", "flags"])
        for r in results:
            n = r["nearest"] + [{"place": "", "miles": ""}] * 3
            w.writerow([r["state"], r["name"], r["lat"], r["lon"], r["miles"], n[0]["place"], n[0]["miles"],
                        n[1]["place"], n[1]["miles"], n[2]["place"], n[2]["miles"], " ".join(r["next_to"]),
                        " | ".join(r["flags"])])
    feats = [{"type": "Feature", "geometry": {"type": "Point", "coordinates": [r["lon"], r["lat"]]},
              "properties": {k: r[k] for k in ("state", "name", "miles", "flags")} | {"nearest": r["nearest"][0]["place"]}}
             for r in results]
    (out / "furthest_by_state.geojson").write_text(json.dumps({"type": "FeatureCollection", "features": feats}) + "\n")

    lines = [
        "# Furthest point from any McDonald's, by state",
        "",
        f"Generated {meta['generated_at']} by `.github/workflows/monthly-data.yml`. Straight-line miles on the WGS84 ellipsoid.",
        f"Stores used: {meta['stores']['US']} US, {meta['stores']['CA']} Canada, {meta['stores']['MX']} Mexico "
        f"(US from {'All the Places' if src.get('us_source') == 'atp' else 'the older repo list'}).",
        "",
        f"**Lower 48:** {lower48['name']}, {lower48['lat']}, {lower48['lon']}, {lower48['miles']} mi "
        f"(nearest: {', '.join(n['place'] + ' ' + str(n['miles']) for n in lower48['nearest'])}).",
        "",
        "Rules: any McDonald's counts (incl. Canada, Mexico); Alaska mainland only; Hawaii 8 main islands only; "
        "spots kept about 100-200 m inside state lines and shorelines. Private land is not checked yet.",
        "",
        "| State | Lat, Lon | Miles | Nearest McDonald's | Older list | Flags |",
        "|---|---|---|---|---|---|",
    ]
    for r in sorted(results, key=lambda r: -r["miles"]):
        lines.append(f"| {r['name']} | {r['lat']}, {r['lon']} | {r['miles']} | {r['nearest'][0]['place']} | "
                     f"{'' if r['old_list_miles'] is None else r['old_list_miles']} | {'; '.join(r['flags'])} |")
    (out / "README.md").write_text("\n".join(lines) + "\n")


if __name__ == "__main__":
    main()
