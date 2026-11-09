# McDonald's locations from All the Places

Refreshed monthly by `.github/workflows/monthly-data.yml`.

- `mcdonalds_us_ca_mx.csv`: McDonald's in the US, Canada and Mexico. Columns: id, lat, lon, address, city, state, country, source.
- `source.json`: when it was fetched, the All the Places files used, and store counts.

Source: [All the Places](https://www.alltheplaces.xyz/) (CC0), spiders `mcdonalds_us` (US), `mcdonalds` (Canada) and `mcdonalds_latin_america` (Mexico). McCafé duplicate rows are dropped.
If the US spider output is missing or has fewer than 12,000 stores, US rows fall back to the older `data/us_mcdonalds.csv` (`source` starts with `old-`) and `source.json` says so.

The older `data/us_mcdonalds.csv` and the live page are left as they were.
