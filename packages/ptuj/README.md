# Ptuj

A retro-futuristic cyan wireframe map of the Municipality of Ptuj, in the style of the vector screens of the 80s and 90s, with:

1. its real outline,
2. quarters,
3. the Drava and
4. Ptujsko jezero,
5. roads,
6. railway and
7. landmarks,
8. with simulated road traffic (wireframe cars)
9. and trains (wireframe wagons),
10. all over the low poly hills of the real terrain (raised twice),
11. with every place shown as a slowly turning 3D wireframe model; point at one for its address, operator, opening hours, phone and website,
12. and the employers on the Employment Service of Slovenia's list of bans on employing foreigners marked: their icon turns into a skull now and again while a ban holds, and their details end with the date it runs to. A place is marked only when its OpenStreetMap address and a distinctive word of the employer's registered name both match the list (`python3 inkscape-scripts/osm/bans.py inkscape-scripts/osm/data` lists the matches).

You move over it as in a first person game: click a spot to look at it and scroll to zoom to it, drag to look around, right drag to move, W A S D or the arrows to walk, E and Q to rise and sink, Shift to hurry, double click to fly nearer and Esc for the whole map. On a touchscreen, one finger looks around and two pinch and move.

`inkscape-scripts/project.sh all` rebuilds `src/map/ptuj.json` from OpenStreetMap and `src/map/terrain.json` from elevation tiles (`project.sh terrain` only the latter, which needs Pillow), and the icons in `src/icons` are SVG for Inkscape.

![Ptuj neon map](screenshot.png)

Map data © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors, available under the [ODbL](https://opendatacommons.org/licenses/odbl/). The quarter borders are approximate.

Bans on employing foreigners from the [Employment Service of Slovenia](https://www.ess.gov.si/delodajalci/zaposlovanje-tujcev/) (Zavod RS za zaposlovanje).

Elevation from [Mapzen Terrain Tiles](https://registry.opendata.aws/terrain-tiles/): Europe terrain data produced using Copernicus data and information funded by the European Union - EU-DEM layers; SRTM and GMTED2010 terrain data courtesy of the U.S. Geological Survey.

## License

MIT
