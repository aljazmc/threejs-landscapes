# Moonshadow Keep

A small first person shooter in elven fantasy style. As an elf with a sword and a bow with explosive arrows, you clear an elven keep of ten monsters. It runs in the browser on desktops, phones and tablets.

**[Play Moonshadow Keep](https://aljazmc.github.io/moonshadow-preview/)** · [Source code](https://github.com/aljazmc/threejs-landscapes/tree/main/packages/moonshadow)

## The fight

|              | Elf                                | Monsters                              |
| ------------ | ---------------------------------- | ------------------------------------- |
| health       | 500                                | 300                                   |
| moving speed | 4 m/s                              | 4 m/s                                 |
| attack       | sword or bow with explosive arrows | blows, 50 damage, at most every 1.2 s |

| Weapon            | Damage | Between attacks | Hits                                                                                                                                                         |
| ----------------- | ------ | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1 sword (default) | 75     | 0.6 s           | the nearest monster within 2.2 m in front of the elf (about 45° to each side)                                                                                |
| 2 bow             | 500    | 3 s             | the arrow flies at 30 m/s, falling slightly, and explodes where it hits: the monster hit takes all 500, every other monster within 9 m less, by its distance |

The main menu has _Play_, _Save_, _Load_ and _Language_ (English, Deutsch, Polski, Slovenščina). The saved game and the language are kept in the browser's local storage.

## Keyboard and mouse

| Mouse / key         | Action                                                 |
| ------------------- | ------------------------------------------------------ |
| mouse               | look around (click into the view to capture the mouse) |
| W A S D, arrow keys | move                                                   |
| Space, left click   | strike or shoot (hold to keep attacking)               |
| 1, 2                | sword, bow                                             |
| Esc                 | pause to the main menu                                 |
| Enter, Esc          | back to the main menu after the end of a game          |

## Touchscreens

| Touch               | Action                                                                           |
| ------------------- | -------------------------------------------------------------------------------- |
| menu items          | tap to choose                                                                    |
| left half           | a joystick where the thumb lands: walk in any direction, slower when tilted less |
| right half          | drag to aim                                                                      |
| ATTACK button       | strike or shoot (hold to keep attacking)                                         |
| the weapon panels   | tap to choose the sword or the bow                                               |
| II at the top       | pause to the main menu                                                           |
| anywhere, game over | tap to return to the main menu                                                   |

Tips for phones and tablets:

- **Play sideways.** The view is 16:9. When you tap _Play_, the game goes fullscreen and locks to landscape where the browser allows it (Chrome and Firefox on Android, Safari on the iPad). iPhones can't open web pages fullscreen, so there the game stays in the page: turn the phone sideways yourself, and hide Safari's toolbar (the page menu in the address bar) for more room.
- **Sound starts with your first touch.** Browsers play sound only after you have used the page, and Safari on iOS only once you lift your finger. If there's no sound, tap the menu once more and check that the silent switch is off.
- **Two thumbs at once.** Keep your left thumb on the joystick while your right thumb aims or holds ATTACK. Only the first finger on the left half steers, so a second finger there aims instead.
- **The sword needs you close.** It reaches only 2.2 m: walk right up to a monster, keep it in front of you and hold ATTACK. Arrows fall a little in flight, so aim slightly above monsters that are far away.
- **Lighter graphics.** Touch devices start with the low quality setting (fewer lights and pixels, no multisampling, a smaller glow), so the game runs smoothly on phones. Other devices switch to it by themselves when the game runs slowly.
- **Mixing inputs works.** On a tablet with a keyboard or mouse, the touch controls hide as soon as you use the keys or mouse, and come back with the next touch.

## Credits

Every model, texture, sound and piece of music is generated by the game's own Blender and FluidSynth scripts, which are in the [source code](https://github.com/aljazmc/threejs-landscapes/tree/main/packages/moonshadow). The texts use Open Sans SemiBold where the device has it, or a similar font. Built with [three.js](https://threejs.org/).

## License

[MIT](LICENSE)
