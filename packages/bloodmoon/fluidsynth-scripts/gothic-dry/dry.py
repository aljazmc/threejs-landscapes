from sound import bandpass, delayed, envelope, fade, mix, noise, normalize, ring

# The flamethrower running dry, 0.4 s: a last sputtering hiss and the clunk
# of the empty valve.


def dry():
    sputter = bandpass(noise(0.25, seed=5), 1500, 6000) * envelope(0.25, attack=0.002, decay=0.2, release=0.05)
    sputter = sputter * (0.6 + 0.4 * (noise(0.25, seed=6) > 0.2))
    clunk = ring([(420, 1.0, 30), (1130, 0.5, 40)], 0.15)
    return normalize(mix(sputter, delayed(0.6 * clunk, 0.22)), 0.5)
