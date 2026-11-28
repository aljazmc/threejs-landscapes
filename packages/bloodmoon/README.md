# Bloodmoon Manor

[![Play](https://img.shields.io/badge/play-in%20the%20browser-c2185b?logo=googlechrome&logoColor=white)](https://aljazmc.github.io/bloodmoon-preview/)
[![Version](https://img.shields.io/github/package-json/v/aljazmc/threejs-landscapes?filename=packages%2Fbloodmoon%2Fpackage.json&label=version&color=0a7bbb)](https://github.com/aljazmc/threejs-landscapes/tags)
[![Publish](https://github.com/aljazmc/threejs-landscapes/actions/workflows/publish-bloodmoon.yml/badge.svg)](https://github.com/aljazmc/threejs-landscapes/actions/workflows/publish-bloodmoon.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![three.js 0.187](https://img.shields.io/badge/three.js-0.187-black?logo=threedotjs)](https://threejs.org/)
[![Touch](https://img.shields.io/badge/touch-ready-4caf50)](#touchscreens)
[![Blender](https://img.shields.io/badge/models-Blender-e87d0d?logo=blender&logoColor=white)](https://www.blender.org/)
[![FluidSynth](https://img.shields.io/badge/music-FluidSynth-2d6db5)](https://www.fluidsynth.org/)
[![NumPy](https://img.shields.io/badge/sounds-NumPy-013243?logo=numpy&logoColor=white)](https://numpy.org/)

A small first person shooter in Victorian gothic style. As a vampire hunter armed with a revolver and a steampunk flamethrower, you clear a vampire's castle of ten creatures of the night. It runs in the browser on desktops, phones and tablets.

**[Play Bloodmoon Manor](https://aljazmc.github.io/bloodmoon-preview/)** · [Source code](https://github.com/aljazmc/threejs-landscapes/tree/main/packages/bloodmoon)

## The hunt

|              | Vampire hunter                     | Creatures                             |
| ------------ | ---------------------------------- | ------------------------------------- |
| health       | 500                                | 300                                   |
| moving speed | 4 m/s                              | 4 m/s                                 |
| attack       | revolver or steampunk flamethrower | blows, 50 damage, at most every 1.2 s |

| Weapon               | Damage         | Firing                                                                                                                           | Hits                                                             |
| -------------------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| 1 revolver (default) | 40             | a silver bullet every 0.5 s                                                                                                      | only the first creature in the line of fire                      |
| 2 flamethrower       | 150 per second | while the trigger is held and the tank has fuel: a full tank burns 4 s and refills in 8 s; once dry, it fires again at a quarter | every creature within 6 m in its cone of fire, not through walls |

The main menu has _Play_, _Save_, _Load_ and _Language_ (English, Deutsch, Polski, Slovenščina). The saved game and the language are kept in the browser's local storage.

## Keyboard and mouse

| Mouse / key         | Action                                                 |
| ------------------- | ------------------------------------------------------ |
| mouse               | look around (click into the view to capture the mouse) |
| W A S D, arrow keys | move                                                   |
| Space, left click   | fire (hold to keep firing)                             |
| 1, 2                | revolver, flamethrower                                 |
| Esc                 | pause to the main menu                                 |
| Enter, Esc          | back to the main menu after the end of a game          |

## Touchscreens

| Touch               | Action                                                                           |
| ------------------- | -------------------------------------------------------------------------------- |
| menu items          | tap to choose                                                                    |
| left half           | a joystick where the thumb lands: walk in any direction, slower when tilted less |
| right half          | drag to look around                                                              |
| FIRE button         | fire (hold to keep firing)                                                       |
| the weapon panels   | tap to choose the revolver or the flamethrower                                   |
| II at the top       | pause to the main menu                                                           |
| anywhere, game over | tap to return to the main menu                                                   |

Tips for phones and tablets:

- **Play sideways.** The view is 16:9. When you tap _Play_, the game goes fullscreen and locks to landscape where the browser allows it (Chrome and Firefox on Android, Safari on the iPad). iPhones can't open web pages fullscreen, so there the game stays in the page: turn the phone sideways yourself, and hide Safari's toolbar (the page menu in the address bar) for more room.
- **Sound starts with your first touch.** Browsers play sound only after you have used the page, and Safari on iOS only once you lift your finger. If there's no sound, tap the menu once more and check that the silent switch is off.
- **Two thumbs at once.** Keep your left thumb on the joystick while your right thumb looks around or holds FIRE. Only the first finger on the left half steers, so a second finger there looks around instead.
- **Lighter graphics.** Touch devices start with the low quality setting (fewer lights and pixels, no multisampling, a smaller bloom), so the game runs smoothly on phones. Other devices switch to it by themselves when the game runs slowly.
- **Mixing inputs works.** On a tablet with a keyboard or mouse, the touch controls hide as soon as you use the keys or mouse, and come back with the next touch.

## Troubleshooting

| What you see                    | What to do                                                                                                                                                        |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A black or empty page           | The game needs WebGL 2. Update the browser, and turn hardware acceleration on in its settings if it is off.                                                       |
| The mouse doesn't turn the view | Click into the view: the browser captures the mouse only after a click. Esc lets it go and pauses the game.                                                       |
| No sound                        | Browsers play sound only after you have pressed a key, clicked or touched the page. Do that once, and check the tab is not muted.                                 |
| _Load_ finds no saved game      | Saves are kept in the browser's local storage, which a private window or clearing the site data throws away, and which is not shared between browsers or devices. |
| It runs slowly                  | The game switches to the low quality by itself after a few seconds of slow play. Make the window smaller or close other tabs if it is still slow.                 |

## Credits

Every model, texture, sound and piece of music is generated by the game's own Blender and FluidSynth scripts, which are in the [source code](https://github.com/aljazmc/threejs-landscapes/tree/main/packages/bloodmoon). The texts are set in [DejaVu Sans](https://dejavu-fonts.github.io/), whose license is in `res/DejaVuSans-LICENSE.txt`. Built with [three.js](https://threejs.org/).

## License

The code is [MIT](LICENSE). Every model, texture, sprite sheet, sound effect and piece of music in `res/` is a generated asset: the game's Blender, NumPy and FluidSynth scripts in the [source code](https://github.com/aljazmc/threejs-landscapes/tree/main/packages/bloodmoon) make all of them, nothing is drawn or recorded by hand, and they are released with the scripts under the same MIT License. They are made by tools that put no terms of their own on what they make:

- [Blender](https://www.blender.org/about/license/) renders the models and textures; it is GNU GPL software, and the GPL does not apply to what you make with it.
- [FluidSynth](https://www.fluidsynth.org/) renders the music (GNU LGPL 2.1 or later) through the [FluidR3_GM](https://packages.debian.org/stable/fluid-soundfont-gm) soundfont by Frank Wen, which is under the MIT License.
- [NumPy](https://numpy.org/doc/stable/license.html) synthesises the sound effects (BSD 3-Clause), and [FFmpeg](https://ffmpeg.org/legal.html) encodes the OGG, WAV and MP3 files (GNU LGPL or GPL, depending on the build).
- [three.js](https://github.com/mrdoob/three.js/blob/dev/LICENSE) runs the game; it is under the MIT License and loaded from [esm.sh](https://esm.sh/).

The font, DejaVu Sans (`res/DejaVuSans.ttf`), is not generated: it is under the Bitstream Vera Fonts license, included in the [LICENSE](LICENSE) and in `res/DejaVuSans-LICENSE.txt`.
