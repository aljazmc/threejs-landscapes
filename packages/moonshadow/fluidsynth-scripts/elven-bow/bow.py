from sound import bandpass, delayed, envelope, fade, lowpass, mix, noise, normalize, pluck, sweep

# The longbow loosing an arrow, 0.5 s: the deep twang of the string (a
# plucked string) and the hiss of the arrow and its fizzing rune charge.


def bow():
    twang = lowpass(pluck(147, 0.45, brightness=0.0, seed=4), 2200) * fade(0.45, 6)
    hiss = bandpass(noise(0.35, seed=5), sweep(2500, 900, 0.35), 8000) * envelope(0.35, attack=0.02, decay=0.3,
        release=0.03)
    return normalize(mix(twang, delayed(0.3 * hiss, 0.02)), 0.7)
