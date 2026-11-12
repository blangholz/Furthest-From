#!/usr/bin/env python3
"""Far From Fries data pipeline.

Turns the repo's monthly McDonald's data and furthest-point lists into
(1) small JSON files bundled in the app and (2) a SQL load for Supabase.

  python3 pipeline/fff_data.py app-data            # writes mobile/assets/data/*.json
  python3 pipeline/fff_data.py sql > load.sql      # stores + spots (+ regions with --regions)
  psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f load.sql

Inputs (defaults are the repo's own files, refreshed monthly by the existing workflow):
  --stores   data/atp/mcdonalds_us_ca_mx.csv          id,lat,lon,address,city,state,country,source
  --states   points/public/furthest_by_state.csv      state,lat,lon,miles,land,nearest_1,...
  --top100   points/public/top100_r50.csv             rank,lat,lon,miles,state,land,nearest_1,...
Regions (--regions) come from Natural Earth (public domain): US states at 1:10m and
countries at 1:50m, downloaded from the natural-earth-vector GitHub repo.
Standard library only.
"""
import argparse, csv, json, os, sys, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NE = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/'
LOWER48_EXCLUDE = {'AK', 'HI'}
STATE_NAMES = {
    'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas', 'CA': 'California', 'CO': 'Colorado',
    'CT': 'Connecticut', 'DE': 'Delaware', 'DC': 'District of Columbia', 'FL': 'Florida', 'GA': 'Georgia',
    'HI': 'Hawaii', 'ID': 'Idaho', 'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa', 'KS': 'Kansas',
    'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine', 'MD': 'Maryland', 'MA': 'Massachusetts',
    'MI': 'Michigan', 'MN': 'Minnesota', 'MS': 'Mississippi', 'MO': 'Missouri', 'MT': 'Montana',
    'NE': 'Nebraska', 'NV': 'Nevada', 'NH': 'New Hampshire', 'NJ': 'New Jersey', 'NM': 'New Mexico',
    'NY': 'New York', 'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio', 'OK': 'Oklahoma',
    'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina', 'SD': 'South Dakota',
    'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah', 'VT': 'Vermont', 'VA': 'Virginia', 'WA': 'Washington',
    'WV': 'West Virginia', 'WI': 'Wisconsin', 'WY': 'Wyoming',
}


def read_csv(path):
    with open(path, newline='', encoding='utf-8') as f:
        return list(csv.DictReader(f))


def load_stores(path):
    out = []
    for r in read_csv(path):
        try:
            lat, lon = float(r['lat']), float(r['lon'])
        except (KeyError, ValueError):
            continue
        out.append({'id': r.get('id', ''), 'lat': lat, 'lon': lon, 'country': r.get('country') or 'US',
                    'state': r.get('state') or None, 'city': r.get('city') or None})
    return out


def load_spots(states_path, top100_path):
    spots = []
    if states_path and os.path.exists(states_path):
        for r in read_csv(states_path):
            spots.append({'kind': 'state', 'state': r['state'], 'rank': None, 'lat': float(r['lat']),
                          'lon': float(r['lon']), 'miles': float(r['miles']), 'land': r.get('land') or None,
                          'nearest': r.get('nearest') or r.get('nearest_1') or None})
    if top100_path and os.path.exists(top100_path):
        for r in read_csv(top100_path):
            spots.append({'kind': 'top100', 'state': r['state'], 'rank': int(r['rank']), 'lat': float(r['lat']),
                          'lon': float(r['lon']), 'miles': float(r['miles']), 'land': r.get('land') or None,
                          'nearest': r.get('nearest') or r.get('nearest_1') or None})
    return spots


def default_path(*candidates):
    for c in candidates:
        p = os.path.join(ROOT, c)
        if os.path.exists(p):
            return p
    return os.path.join(ROOT, candidates[0])


def cmd_app_data(a):
    stores = load_stores(a.stores)
    spots = load_spots(a.states, a.top100)
    outdir = os.path.join(ROOT, 'mobile', 'assets', 'data')
    os.makedirs(outdir, exist_ok=True)
    # Compact: [lat, lon] at 5 decimals (about 1 m). Only what the live readout and map need.
    with open(os.path.join(outdir, 'stores.json'), 'w') as f:
        json.dump({'source': os.path.relpath(a.stores, ROOT), 'count': len(stores),
                   'points': [[round(s['lat'], 5), round(s['lon'], 5)] for s in stores]}, f, separators=(',', ':'))
    with open(os.path.join(outdir, 'spots.json'), 'w') as f:
        json.dump([dict(s, state_name=STATE_NAMES.get(s['state'], s['state'])) for s in spots], f,
                  separators=(',', ':'))
    print(f'wrote {len(stores)} stores and {len(spots)} spots to {os.path.relpath(outdir, ROOT)}', file=sys.stderr)


def q(v):
    if v is None:
        return 'null'
    if isinstance(v, (int, float)):
        return repr(v)
    return "'" + str(v).replace("'", "''") + "'"


def fetch_json(name):
    cache = os.path.join(ROOT, 'pipeline', '.cache')
    os.makedirs(cache, exist_ok=True)
    path = os.path.join(cache, name)
    if not os.path.exists(path):
        print(f'downloading {name}', file=sys.stderr)
        urllib.request.urlretrieve(NE + name, path)
    with open(path, encoding='utf-8') as f:
        return json.load(f)


def regions_sql():
    yield 'delete from public.regions;'
    states = fetch_json('ne_10m_admin_1_states_provinces.geojson')
    for feat in states['features']:
        p = feat['properties']
        if p.get('iso_a2') != 'US':
            continue
        code = (p.get('postal') or '').upper()
        if code not in STATE_NAMES:
            continue
        geo = json.dumps(feat['geometry'], separators=(',', ':'))
        yield (f"insert into public.regions (code, name, kind, lower48, geom) values ({q('US-' + code)}, "
               f"{q(STATE_NAMES[code])}, 'us_state', {str(code not in LOWER48_EXCLUDE).lower()}, "
               f"st_multi(st_makevalid(st_setsrid(st_geomfromgeojson({q(geo)}), 4326))));")
    countries = fetch_json('ne_50m_admin_0_countries.geojson')
    seen = set()
    for feat in countries['features']:
        p = feat['properties']
        code = p.get('ISO_A2_EH') or p.get('ISO_A2')
        if not code or code in ('-99', 'US') or code in seen:
            continue
        seen.add(code)
        geo = json.dumps(feat['geometry'], separators=(',', ':'))
        yield (f"insert into public.regions (code, name, kind, lower48, geom) values ({q(code)}, "
               f"{q(p.get('NAME') or code)}, 'country', false, "
               f"st_multi(st_collectionextract(st_makevalid(st_setsrid(st_geomfromgeojson({q(geo)}), 4326)), 3)));")


def cmd_sql(a):
    stores = load_stores(a.stores) if not a.no_stores else []
    spots = load_spots(a.states, a.top100)
    w = sys.stdout.write
    w('-- Far From Fries data load, generated by pipeline/fff_data.py\n')
    w('set search_path = public, extensions;\nbegin;\n')
    if a.regions:
        for line in regions_sql():
            w(line + '\n')
    w(f"select private.begin_import({q(a.source)}, {q(a.notes)});\n")
    for i in range(0, len(stores), 1000):
        rows = ','.join(f"({q(s['id'])},{s['lat']},{s['lon']},{q(s['country'])},{q(s['state'])},{q(s['city'])})"
                        for s in stores[i:i + 1000])
        w(f'insert into private.stage_stores (source_id, lat, lon, country, state, city) values {rows};\n')
    for s in spots:
        w('insert into private.stage_spots (kind, state, rank, lat, lon, distance_mi, land, nearest) values '
          f"({q(s['kind'])},{q(s['state'])},{q(s['rank'])},{s['lat']},{s['lon']},{s['miles']},{q(s['land'])},{q(s['nearest'])});\n")
    w('select private.finish_import((select max(id) from public.data_versions));\ncommit;\n')


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('command', choices=['app-data', 'sql'])
    ap.add_argument('--stores', default=default_path('data/atp/mcdonalds_us_ca_mx.csv'))
    ap.add_argument('--states', default=default_path('points/public/furthest_by_state.csv', 'points/furthest_by_state.csv'))
    ap.add_argument('--top100', default=default_path('points/public/top100_r50.csv'))
    ap.add_argument('--regions', action='store_true', help='also (re)load US state and country polygons')
    ap.add_argument('--no-stores', action='store_true')
    ap.add_argument('--source', default='AllThePlaces monthly refresh')
    ap.add_argument('--notes', default=None)
    a = ap.parse_args()
    {'app-data': cmd_app_data, 'sql': cmd_sql}[a.command](a)


if __name__ == '__main__':
    main()
