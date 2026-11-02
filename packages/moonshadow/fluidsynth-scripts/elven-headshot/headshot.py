from sound import bandpass, delayed, envelope, fade, mix, noise, normalize, ring, sine, sweep

# A blow or an arrow to a monster's head, 0.55 s: a heavy crunch of bone and
# a clear elven chime, a bright fifth rising after it.


def headshot():
    crunch = bandpass(noise(0.07, seed=41), 600, 5000) * envelope(0.07, attack=0.001, decay=0.05, release=0.01)
    thump = sine(sweep(180, 55, 0.14), 0.14) * fade(0.14, 22)
    chime = mix(ring([(1760, 1.0, 8), (3520, 0.3, 12)], 0.5), delayed(ring([(2637, 0.8, 8), (5274, 0.2, 12)], 0.45), 0.06))
    return normalize(mix(crunch, 0.8 * thump, delayed(0.3 * chime, 0.03)), 0.85)
