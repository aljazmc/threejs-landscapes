# Ptuj

[![Open the map](https://img.shields.io/badge/open-the%20map-00bcd4?logo=googlechrome&logoColor=white)](https://aljazmc.github.io/ptuj-preview/)
[![Version](https://img.shields.io/github/package-json/v/aljazmc/threejs-landscapes?filename=packages%2Fptuj%2Fpackage.json&label=version&color=0a7bbb)](https://github.com/aljazmc/threejs-landscapes/tags)
[![Publish](https://github.com/aljazmc/threejs-landscapes/actions/workflows/publish-ptuj.yml/badge.svg)](https://github.com/aljazmc/threejs-landscapes/actions/workflows/publish-ptuj.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/aljazmc/threejs-landscapes/blob/main/LICENSE)
[![Map data: ODbL](https://img.shields.io/badge/map%20data-ODbL-7ebc6f?logo=openstreetmap&logoColor=white)](https://www.openstreetmap.org/copyright)
[![three.js 0.187](https://img.shields.io/badge/three.js-0.187-black?logo=threedotjs)](https://threejs.org/)
[![React Three Fiber](https://img.shields.io/badge/React%20Three%20Fiber-R3F-000000?logo=react&logoColor=61dafb)](https://r3f.docs.pmnd.rs/)
[![Touch](https://img.shields.io/badge/touch-ready-4caf50)](#touchscreens)

A retro-futuristic cyan wireframe map of the Municipality of Ptuj, in the style of the vector screens of the 80s and 90s. It runs in the browser on desktops, phones and tablets.

**[Open the map](https://aljazmc.github.io/ptuj-preview/)** · [Source code](https://github.com/aljazmc/threejs-landscapes/tree/main/packages/ptuj)

![The old town of Ptuj in the app: spinning wireframe models of the places, traffic and a train](preview.gif)

## On the map

- the municipality's real outline, its quarters and villages
- the Drava, Ptujsko jezero, woods, vineyards and parks
- roads, the railway and landmarks
- simulated road traffic (wireframe cars) and trains (wireframe wagons)
- the low poly hills of the real terrain, raised twice, as a faint wireframe of flat shaded triangles. The hills hide the lines, places and names behind them.
- every place as a slowly turning 3D wireframe model. Point at one for its address, operator, opening hours, phone and website.
- the employers on the Employment Service of Slovenia's list of bans on employing foreigners. While a ban holds, the place's model glitches into a skull now and again, and its details end with the date the ban runs to. A place is marked only when its OpenStreetMap address and a distinctive word of the employer's registered name both match the list. See [About the bans](#about-the-bans) before you draw conclusions from it.

## About the bans

- **Source.** The [list of employers banned from employing foreigners](https://www.ess.gov.si/fileadmin/user_upload/Delodajalci/Seznam_delodajalcev_prepoved_zaposlovanja_tujcev.xlsx) (_Seznam delodajalcev s prepovedjo zaposlovanja tujcev_), published by the [Employment Service of Slovenia](https://www.ess.gov.si/delodajalci/zaposlovanje-tujcev/) (Zavod RS za zaposlovanje, ESS). Only the ESS list is authoritative: check an employer there.
- **Date.** This version of the map uses the list of 2 November 2026. The map's credits (the _Map data © OpenStreetMap contributors_ button) always give the date of the list it was built from. Bans imposed or lifted since then are not on the map; a ban that ends while the page is open loses its skull by itself.
- **Not an accusation.** The map only shows what the public list says, matched to OpenStreetMap by a script. A ban is an administrative measure of the ESS with its own reasons and end date, and says nothing more about the employer.
- **Matches can be wrong.** OpenStreetMap places are matched to the list by post code, street, house number and a distinctive word of the registered name, never by the address alone, because several firms share buildings. A place can still be matched wrongly when the OpenStreetMap tags of a business are outdated or another firm with a similar name is at the same address, and a listed employer can be missed when its tags don't show the name.
- **Report a wrong match.** If a place has a skull it shouldn't have, or is missing one, [open an issue](https://github.com/aljazmc/threejs-landscapes/issues/new?title=ptuj%3A%20wrong%20ban%20match) with the place's name and address, or write to the repository's owner through [GitHub](https://github.com/aljazmc). A wrong match is fixed in the next version of the map; wrong OpenStreetMap tags can also be corrected [on OpenStreetMap](https://www.openstreetmap.org/fixthemap).

## Keyboard and mouse

| Mouse / key       | Action                                              |
| ----------------- | --------------------------------------------------- |
| click             | look at that spot and choose its quarter or village |
| wheel             | zoom toward the spot in the middle of the view      |
| double click      | fly a third of the way to the spot                  |
| left drag         | look around                                         |
| right/middle drag | move over the map                                   |
| W A S D, arrows   | walk                                                |
| E, Q              | rise, sink                                          |
| Shift             | hurry                                               |
| point at an icon  | what is known of the place                          |
| Esc               | back to the whole map                               |

## Touchscreens

| Touch                       | Action                                                                  |
| --------------------------- | ----------------------------------------------------------------------- |
| tap                         | look at that spot and choose its quarter or village                     |
| one finger                  | drag to look around                                                     |
| two fingers                 | pinch to zoom toward the ground between them, drag to move over the map |
| slide a finger over an icon | what is known of the place                                              |
| ← vsa občina                | back to the whole map                                                   |

Tips for phones and tablets:

- **Pinch where you want to go.** The zoom heads for the ground between your fingers, so put them around the spot you want to see closer.
- **Lost?** Once you have tapped a quarter or village, the _← vsa občina_ button flies back to the view of the whole municipality.
- **Behind a hill.** Places hidden behind hills can't be pointed at. Move a little with two fingers to see them.

## Troubleshooting

| What you see                                        | What to do                                                                                                 |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| A black or empty page                               | The map needs WebGL 2. Update the browser, and turn hardware acceleration on in its settings if it is off. |
| A place can't be pointed at, or its name is missing | It is behind a hill from where you look. Move or rise a little (E, or two fingers) to see it.              |
| The view is lost somewhere                          | Tap or click a quarter, then _← vsa občina_ to fly back to the whole municipality.                         |
| It runs slowly                                      | Make the window smaller, or close other tabs; the map draws all of the terrain and traffic every frame.    |
| A skull on the wrong place                          | See [Report a wrong match](#about-the-bans).                                                               |

## Credits

Map data © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors, available under the [ODbL](https://opendatacommons.org/licenses/odbl/). The quarter borders are approximate.

Bans on employing foreigners from the [Employment Service of Slovenia](https://www.ess.gov.si/delodajalci/zaposlovanje-tujcev/) (Zavod RS za zaposlovanje).

Elevation from [Mapzen Terrain Tiles](https://registry.opendata.aws/terrain-tiles/): Europe terrain data produced using Copernicus data and information funded by the European Union - EU-DEM layers; SRTM and GMTED2010 terrain data courtesy of the U.S. Geological Survey.

Built with [three.js](https://threejs.org/), [React](https://react.dev/) and [React Three Fiber](https://r3f.docs.pmnd.rs/).

## License

The code is [MIT](https://github.com/aljazmc/threejs-landscapes/blob/main/LICENSE). The map's files are generated assets, made by the Python scripts in the [source code](https://github.com/aljazmc/threejs-landscapes/tree/main/packages/ptuj), and keep the terms of the data they come from:

- `map/ptuj.json` is generated from OpenStreetMap data, so it stays under the [ODbL](https://opendatacommons.org/licenses/odbl/), © OpenStreetMap contributors; the bans layer in it comes from the public list of the Employment Service of Slovenia.
- `map/terrain.json` is generated with a [Pillow](https://github.com/python-pillow/Pillow/blob/main/LICENSE) script (MIT-CMU license) from Mapzen Terrain Tiles, with the credits above.
- `preview.gif` is recorded by a script in headless Firefox and encoded with [FFmpeg](https://ffmpeg.org/legal.html) (GNU LGPL or GPL, depending on the build), and is under the MIT License of the code.

The map runs on [three.js](https://github.com/mrdoob/three.js/blob/dev/LICENSE), [React](https://github.com/facebook/react/blob/main/LICENSE) and [React Three Fiber](https://github.com/pmndrs/react-three-fiber/blob/master/LICENSE), all under the MIT License and loaded from [esm.sh](https://esm.sh/).
