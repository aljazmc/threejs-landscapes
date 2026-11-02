from sound import bandpass, delayed, envelope, fade, highpass, lowpass, mix, noise, normalize, ring, sine, sweep

# The elven sword biting into a monster, 0.5 s: the swish of the blade, a
# heavy chop and the bright ring of the blade (inharmonic partials).


def sword():
    swish = bandpass(noise(0.12, seed=1), sweep(600, 3000, 0.12), 7000) * envelope(0.12, attack=0.08, decay=0.03,
        release=0.01)
    chop = sine(sweep(160, 70, 0.15), 0.15) * fade(0.15, 25) + 0.5 * lowpass(noise(0.15, seed=2), 900) * fade(0.15, 30)
    shine = ring([(1560, 1.0, 7), (2410, 0.6, 9), (3720, 0.4, 13), (5130, 0.25, 18)], 0.4)
    return normalize(mix(0.5 * swish, delayed(chop, 0.09), delayed(0.3 * shine, 0.09)), 0.8)
