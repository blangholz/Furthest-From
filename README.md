# Furthest From

First test for the Furthest From app: a phone page that shows your live straight-line distance to the nearest US McDonald's as you drive.

Live page: https://blangholz.github.io/Furthest-From/

## Use
Open the link in Safari on your phone, tap **Start live GPS** and allow location. Your position stays on the phone; nothing is sent or saved. Glance at it only when stopped, or hand the phone to a passenger.

No GPS handy? Tap the map to drop a pin, or press **Simulate US 50 drive**.

## Data: personal testing only
`data/` holds 13,756 US McDonald's locations (CSV and GeoJSON) merged from two third-party public datasets scraped from McDonald's store locator. Their licensing is unclear, so this data is for personal testing only and should not be reused or redistributed. The public app should be rebuilt from OpenStreetMap (ODbL) or AllThePlaces (CC0). See `data/README.md` for sources and caveats. The same points are embedded in `index.html`, so the page needs no separate download.
