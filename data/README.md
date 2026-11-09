# US McDonald's locations (Furthest From test data)

Built 2026-11-09 for the Furthest From live-distance test page. Personal testing only; see Caveats.

## Files
- `us_mcdonalds.csv`: one row per location. Columns: id, lat, lon, address, city, state, zip, source.
- `us_mcdonalds.geojson`: same rows as Point features (lon, lat), other columns as properties.

## Count
13,756 locations across all 50 states, DC, Guam and the Northern Mariana Islands.

## How it was built
1. Base: 12,888 US locations from the public GitHub repo Shanegrinkewitz/mcdonalds-locations-api (`locations.sqlite`, last commit 2025-05-06, repo license MIT). Every row has lat/lon, address, city, state and zip.
2. Gap fill: that base is thin in the rural West (for example WY 8, MT 28, NM 65, NV 115). So 868 more points were added from Oren-Lindsey/mcdonalds-locations (`mickyds.csv`, last commit 2022-04-29, derived from mcbroken.com, no license file): US rows marked active with no other point within 0.25 miles. These rows have `source=2022`, an id starting `2022-`, and no zip.

## Caveats
- Neither source is official. Both were collected by third parties from McDonald's own store locator, so the licensing of the underlying data is unclear. Fine for a private test; for the public app, switch to OpenStreetMap (ODbL, `brand:wikidata=Q38076`) or the AllThePlaces McDonald's spider (CC0).
- `source=2022` rows may include stores that have closed since 2022, which would make distances read slightly short in those spots.
- Two real stores within 0.25 miles of each other can be merged away only where one came from the 2022 set.
- Coordinates are as published; not geocoded or checked by hand.
