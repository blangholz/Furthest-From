"""Furthest-from-McDonald's spots restricted to publicly accessible land.

Land: USGS PAD-US 4.1 fee parcels (public domain), Pub_Access = OA (open access).
A second set also allows RA (restricted: permit or seasonal, mostly wildlife refuges).
Closed (XA) and unknown (UK) access are left out, so military ranges, the Nevada
Test Site and state trust land of unknown access do not count.

Outputs in --out:
  top100_r50.csv            lower 48, greedy pick, each spot >= 50 mi from every higher one
  furthest_by_state.csv     one spot per state + DC (Alaska mainland, Hawaii 8 main islands)
  *_or_restricted.csv       the same, also allowing restricted-access parcels
  results.json, README.md

Method: rasterize the land (0.005 deg lower 48, 0.01 AK, 0.002 HI), measure distance to
the nearest store at every cell, then refine each pick exactly on the parcel edges and
Voronoi vertices, keeping the spot about 30 m inside the parcel. Each state's any-land
spot (--prev) is also tried so tiny islands such as the Dry Tortugas are not missed.
"""
import argparse
import csv, json, os, sys, time
from collections import Counter
import numpy as np
import pyarrow.parquet as pq
import shapely
from shapely import STRtree
from shapely.geometry import box as sbox, shape, Polygon, MultiPolygon
import shapefile
import rasterio.features
from rasterio.transform import from_origin
from scipy.spatial import cKDTree, ConvexHull
from pyproj import Geod

R_MI = 3958.7613
GEOD = Geod(ellps="WGS84")
M_PER_MI = 1609.344
STATE_SHRINK = 0.002   # same as the main run
INSIDE = 0.0003        # keep the spot ~30 m inside accessible land
T0 = time.time()

def log(*a):
    print(f"[{time.time()-T0:6.0f}s]", *a, flush=True)

def unit(lat, lon):
    la, lo = np.radians(lat), np.radians(lon)
    return np.column_stack([np.cos(la)*np.cos(lo), np.cos(la)*np.sin(lo), np.sin(la)])

def chord_mi(d):
    return 2*np.arcsin(np.clip(d/2, 0, 1))*R_MI

ap = argparse.ArgumentParser()
ap.add_argument("--stores", required=True)
ap.add_argument("--padus", required=True, help="PAD-US 4.1 fee layer as GeoParquet")
ap.add_argument("--states", required=True, help="National Atlas statesp010g shapefile, without extension")
ap.add_argument("--prev", required=True, help="any-land furthest_by_state.csv from furthest_points.py")
ap.add_argument("--out", required=True)
ap.add_argument("--cache", default="/tmp/padus_cache.pkl")
args = ap.parse_args()
stores_csv, fee_path, states_base, outdir = args.stores, args.padus, args.states, args.out
os.makedirs(outdir, exist_ok=True)

# ---- stores
rows = [r for r in csv.DictReader(open(stores_csv))]
slat = np.array([float(r["lat"]) for r in rows]); slon = np.array([float(r["lon"]) for r in rows])
xyz = unit(slat, slon); tree = cKDTree(xyz)
hull = ConvexHull(np.unique(np.round(xyz, 8), axis=0))
n = hull.equations[:, :3]; n /= np.linalg.norm(n, axis=1)[:, None]
vlat = np.degrees(np.arcsin(np.clip(n[:, 2], -1, 1))); vlon = np.degrees(np.arctan2(n[:, 1], n[:, 0]))
log("stores", len(rows))

def near_mi(lat, lon):
    d, i = tree.query(unit(np.atleast_1d(lat), np.atleast_1d(lon)))
    return chord_mi(d), i

def geodesic(lat, lon, k=8):
    _, idx = tree.query(unit([lat], [lon]), k=k)
    idx = np.atleast_1d(idx[0])
    _, _, dist = GEOD.inv(np.full(len(idx), lon), np.full(len(idx), lat), slon[idx], slat[idx])
    o = np.argsort(dist)
    return dist[o]/M_PER_MI, idx[o]

# ---- states
sr = shapefile.Reader(states_base, encoding="latin1")
by = {}
for rec, shp in zip(sr.iterRecords(), sr.iterShapes()):
    if rec["TYPE"] != "Land":
        continue
    g = shapely.make_valid(shape(shp.__geo_interface__))
    by.setdefault(rec["STATE_ABBR"], []).append(g)
states = {}
states_full = {}
for code, gs in by.items():
    if code in ("PR", "VI", "GU", "AS", "MP", "UM"):
        continue
    g = shapely.union_all(gs)
    parts = sorted([p for p in getattr(g, "geoms", [g]) if p.geom_type == "Polygon"], key=lambda p: -p.area)
    if code == "AK":
        parts = parts[:1]
    elif code == "HI":
        parts = [p for p in parts if p.centroid.x > -160.6][:8]
    states_full[code] = shapely.make_valid(MultiPolygon(parts).buffer(-0.0005))
    g = shapely.make_valid(MultiPolygon(parts).buffer(-STATE_SHRINK))
    states[code] = g
codes = sorted(states)
names = {}
for rec in sr.iterRecords():
    names.setdefault(rec["STATE_ABBR"], rec["NAME"])
log("states", len(codes))

# ---- PAD-US accessible land
import os, pickle
cache = args.cache
if os.path.exists(cache):
    acc, meta = pickle.load(open(cache, "rb"))
    acc = {a: shapely.from_wkb(v) for a, v in acc.items()}
    log("PAD-US from cache", {a: len(v) for a, v in acc.items()})
else:
    pf = pq.ParquetFile(fee_path)
    acc = {"OA": [], "RA": []}
    meta = {"OA": [], "RA": []}
    for b in pf.iter_batches(columns=["Pub_Access", "SHAPE", "Mang_Name", "Unit_Nm", "Des_Tp"], batch_size=20000):
        d = b.to_pydict()
        for a, w, mn, un, dt in zip(d["Pub_Access"], d["SHAPE"], d["Mang_Name"], d["Unit_Nm"], d["Des_Tp"]):
            if a in acc and w:
                acc[a].append(w); meta[a].append((mn, un, dt))
    for a in acc:
        acc[a] = shapely.from_wkb(acc[a])
        ok = ~shapely.is_valid(acc[a])
        if ok.any():
            acc[a][ok] = shapely.make_valid(acc[a][ok])
        log("PAD-US", a, len(acc[a]))
    pickle.dump(({a: shapely.to_wkb(v) for a, v in acc.items()}, meta), open(cache, "wb"))
DROPPED = {}
for a in acc:
    b = shapely.bounds(acc[a])
    bad = (b[:, 2] - b[:, 0] > 180) | np.array(["submerged" in (m[1] or "").lower() for m in meta[a]])
    DROPPED[a] = [meta[a][i][1] for i in np.nonzero(bad)[0]]
    acc[a] = acc[a][~bad]; meta[a] = [m for m, x in zip(meta[a], bad) if not x]
    log("dropped", a, len(DROPPED[a]), "antimeridian-spanning or submerged parcels", DROPPED[a][:8])
trees = {a: STRtree(acc[a]) for a in acc}

GRIDS = {
    "L48": dict(w=-124.85, n=49.45, res=0.005, nx=11600, ny=5010),
    "AK": dict(w=-169.2, n=71.5, res=0.01, nx=3950, ny=2050),
    "HI": dict(w=-160.6, n=22.3, res=0.002, nx=2950, ny=1750),
}
def grid_of(code):
    return "AK" if code == "AK" else "HI" if code == "HI" else "L48"

def raster(geoms, val, G):
    tr = from_origin(G["w"], G["n"], G["res"], G["res"])
    return rasterio.features.rasterize(((g, v) for g, v in zip(geoms, val)), out_shape=(G["ny"], G["nx"]),
                                       transform=tr, fill=0, dtype="uint8")

cells = {}  # grid -> dict of arrays for cells inside a state
for gname, G in GRIDS.items():
    gcodes = [c for c in codes if grid_of(c) == gname]
    st = raster([states[c] for c in gcodes], [i+1 for i in range(len(gcodes))], G)
    gb = sbox(G["w"], G["n"]-G["res"]*G["ny"], G["w"]+G["res"]*G["nx"], G["n"])
    masks = {}
    for a in acc:
        sel = trees[a].query(gb)
        masks[a] = raster(acc[a][sel], np.ones(len(sel), int), G)
    iy, ix = np.nonzero(st)
    lat = G["n"] - (iy+0.5)*G["res"]; lon = G["w"] + (ix+0.5)*G["res"]
    mi = np.empty(len(lat))
    for s in range(0, len(lat), 2_000_000):
        mi[s:s+2_000_000] = near_mi(lat[s:s+2_000_000], lon[s:s+2_000_000])[0]
    cells[gname] = dict(lat=lat, lon=lon, mi=mi, st=np.array(gcodes)[st[iy, ix]-1],
                        OA=masks["OA"][iy, ix] > 0, RA=masks["RA"][iy, ix] > 0)
    del masks
    log("grid", gname, len(lat), "cells; OA", cells[gname]["OA"].sum(), "RA", cells[gname]["RA"].sum())

def region(code, lat, lon, half, kinds):
    bx = sbox(lon-half, lat-half, lon+half, lat+half)
    parts = []
    for a in kinds:
        sel = trees[a].query(bx, predicate="intersects")
        parts += list(acc[a][sel])
    if not parts:
        return None, bx
    g = shapely.union_all(shapely.intersection(np.array(parts, dtype=object), bx))
    g = shapely.intersection(g, states_full[code])
    return g, bx

def refine(code, lat, lon, kinds, half=0.04, tries=4):
    for attempt in range(tries):
        g, bx = region(code, lat, lon, half, kinds)
        if g is None or g.is_empty:
            return None
        gi = g.buffer(-INSIDE)
        if gi.is_empty:
            gi = g
        polysx = [p for p in getattr(gi, "geoms", [gi]) if p.geom_type == "Polygon"]
        if not polysx:
            return None
        pts = []
        for p in polysx:
            for ring in [p.exterior, *p.interiors]:
                pts.append(shapely.get_coordinates(shapely.segmentize(ring, 0.0002)))
        pts = np.vstack(pts)
        inb = (vlon > lon-half) & (vlon < lon+half) & (vlat > lat-half) & (vlat < lat+half)
        if inb.any():
            vin = shapely.contains_xy(gi, vlon[inb], vlat[inb])
            pts = np.vstack([pts, np.column_stack([vlon[inb][vin], vlat[inb][vin]])])
        m, _ = near_mi(pts[:, 1], pts[:, 0])
        k = int(np.argmax(m)); blon, blat = pts[k]
        # on the box edge: the max may lie outside, widen and retry
        if min(blon-(lon-half), (lon+half)-blon, blat-(lat-half), (lat+half)-blat) < 0.001 and attempt < tries - 1:
            lat, lon, half = blat, blon, half*2.5
            continue
        dist, idx = geodesic(blat, blon)
        return dict(lat=round(float(blat), 5), lon=round(float(blon), 5), miles=round(float(dist[0]), 1),
                    nearest=[dict(miles=round(float(x), 2), city=rows[i]["city"], state=rows[i]["state"],
                                  country=rows[i]["country"], source=rows[i]["source"]) for x, i in zip(dist[:3], idx[:3])])
    return None

def land_label(lat, lon, kinds):
    pt = shapely.Point(lon, lat)
    for a in kinds:
        sel = trees[a].query(pt.buffer(INSIDE*2), predicate="intersects")
        for i in sel:
            mn, un, dt = meta[a][i]
            return f"{un} ({mn}, {a})"
    return ""

def mask_for(c, kinds):
    m = np.zeros(len(c["lat"]), bool)
    for a in kinds:
        m |= c[a]
    return m

PREV = {r["state"]: (float(r["lat"]), float(r["lon"])) for r in csv.DictReader(open(args.prev))}

def per_state(kinds):
    out = {}
    for code in codes:
        c = cells[grid_of(code)]
        sel = np.nonzero((c["st"] == code) & mask_for(c, kinds))[0]
        if len(sel) == 0:
            out[code] = None; continue
        order = sel[np.argsort(-c["mi"][sel])]
        cands = []
        for i in order[:20000]:
            if all(abs(c["lat"][i]-c["lat"][j]) + abs(c["lon"][i]-c["lon"][j]) > 0.3 for j in cands):
                cands.append(i)
            if len(cands) == 4:
                break
        best = None
        pts = [(c["lat"][i], c["lon"][i]) for i in cands]
        if code in PREV:
            pts.append(PREV[code])
        for la, lo in pts:
            r = refine(code, la, lo, kinds)
            if r and (best is None or r["miles"] > best["miles"]):
                best = r
        if best:
            best["land"] = land_label(best["lat"], best["lon"], kinds)
        out[code] = best
        log(kinds, code, best and (best["lat"], best["lon"], best["miles"], best["land"]))
    return out

def top100(kinds, gap=50, extra=None):
    """Greedy pick on refined spots: each kept spot is >= gap miles from every higher one."""
    c = cells["L48"]
    m = mask_for(c, kinds) if kinds else np.ones(len(c["lat"]), bool)
    sel = np.nonzero(m & (c["mi"] > 25))[0]
    sel = sel[np.argsort(-c["mi"][sel])]
    U = unit(c["lat"][sel], c["lon"][sel]); gt = cKDTree(U)
    blocked = np.zeros(len(sel), bool)
    ch = 2*np.sin(gap/R_MI/2)
    extra = sorted(extra or [], key=lambda r: -r["miles"]); ei = 0
    kept = []; KU = []
    def far_enough(r):
        if not KU:
            return True
        d, _ = cKDTree(np.array(KU)).query(unit([r["lat"]], [r["lon"]]))
        return chord_mi(d[0]) >= gap
    def keep(r):
        kept.append(r); KU.append(unit([r["lat"]], [r["lon"]])[0])
        blocked[gt.query_ball_point(KU[-1], ch)] = True
    for k in range(len(sel)):
        if len(kept) == 100:
            break
        i = sel[k]
        while ei < len(extra) and extra[ei]["miles"] >= c["mi"][i] and len(kept) < 100:
            if far_enough(extra[ei]):
                keep(dict(extra[ei], from_state_point=True))
            ei += 1
        if blocked[k] or len(kept) == 100:
            continue
        code = c["st"][i]
        r = refine(code, c["lat"][i], c["lon"][i], kinds, half=0.02, tries=2) if kinds else None
        if r is None:
            r = dict(lat=round(float(c["lat"][i]), 5), lon=round(float(c["lon"][i]), 5),
                     miles=round(float(c["mi"][i]), 1), nearest=[])
        r["state"] = code
        if far_enough(r):
            keep(r)
        else:
            blocked[k] = True
    for rank, r in enumerate(kept, 1):
        r["rank"] = rank
        r["land"] = r.get("land") or (land_label(r["lat"], r["lon"], kinds) if kinds else "")
    return kept

prev_rows = {r["state"]: r for r in csv.DictReader(open(args.prev))}

def near_cols(r):
    n = (r.get("nearest") or []) + [{}, {}]
    def lab(x):
        return f"{x['city']}, {x['state'] or x['country']}" + (" (older list)" if x.get("source", "atp") != "atp" else "") if x else ""
    return [lab(n[0]), n[0].get("miles", ""), lab(n[1]), n[1].get("miles", "")]

def write(label, sp, t, suffix):
    with open(f"{outdir}/top100_r50{suffix}.csv", "w", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(["rank", "lat", "lon", "miles", "state", "land", "nearest_1", "nearest_1_mi", "nearest_2", "nearest_2_mi"])
        for r in t:
            w.writerow([r["rank"], r["lat"], r["lon"], r["miles"], r["state"], r["land"], *near_cols(r)])
    rows = []
    for code, r in sp.items():
        p = prev_rows.get(code)
        if r is None:
            rows.append([code, names.get(code, code), "", "", "", "no accessible land found", "", "", "", "", p and p["miles"], ""])
            continue
        mv = ""
        if p:
            mv = round(GEOD.inv(float(p["lon"]), float(p["lat"]), r["lon"], r["lat"])[2] / M_PER_MI, 1)
        rows.append([code, names.get(code, code), r["lat"], r["lon"], r["miles"], r["land"], *near_cols(r),
                     p and p["miles"], mv])
    rows.sort(key=lambda x: -(x[4] or 0))
    with open(f"{outdir}/furthest_by_state{suffix}.csv", "w", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(["state", "name", "lat", "lon", "miles", "land", "nearest_1", "nearest_1_mi", "nearest_2", "nearest_2_mi",
                    "any_land_miles", "moved_from_any_land_mi"])
        w.writerows(rows)
    return rows

out = {}
md = ["# Furthest spots on accessible public land", "",
      "Generated by `scripts/public_points.py` from PAD-US 4.1 (USGS, public domain) open-access parcels,",
      "the same McDonald's list as `points/` (US, Canada, Mexico), and National Atlas state lines.",
      "Spots sit about 30 m inside the parcel. Check for private inholdings on site.", ""]
for label, kinds, suffix in [("open", ["OA"], ""), ("open_or_restricted", ["OA", "RA"], "_or_restricted")]:
    sp = per_state(kinds)
    ex = [dict(r, state=k) for k, r in sp.items() if r and k not in ("AK", "HI")]
    t = top100(kinds, extra=ex)
    out[label] = dict(states=sp, top100=t)
    srows = write(label, sp, t, suffix)
    spread = Counter(r["state"] for r in t).most_common()
    md += [f"## {'Open access' if label == 'open' else 'Open or restricted access'}", "",
           f"Top 100 (50 mi gap): #1 {t[0]['miles']} mi in {t[0]['state']} ({t[0]['lat']}, {t[0]['lon']}), "
           f"#100 {t[-1]['miles']} mi. {len(spread)} states: " + ", ".join(f"{k} {v}" for k, v in spread) + ".", "",
           "| State | Spot | Miles | Land |", "|---|---|---|---|"]
    md += [f"| {x[1]} | {x[2]}, {x[3]} | {x[4]} | {x[5]} |" for x in srows] + [""]
out["dropped_parcels"] = DROPPED
out["generated_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
json.dump(out, open(f"{outdir}/results.json", "w"), indent=1)
open(f"{outdir}/README.md", "w").write("\n".join(md) + "\n")
log("done")
