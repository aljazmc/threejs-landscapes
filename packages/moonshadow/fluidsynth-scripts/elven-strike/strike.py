from sound import bandpass, delayed, envelope, fade, lowpass, mix, noise, normalize, sine, sweep

# A monster's blow, 0.4 s: the whoosh of a heavy weapon or claw and a dull
# thump.


def strike():
    whoosh = bandpass(noise(0.25, seed=11), sweep(300, 1500, 0.25), 4000) * envelope(0.25, attack=0.18,
        decay=0.06, release=0.01)
    thump = sine(sweep(110, 50, 0.2), 0.2) * fade(0.2, 18) + 0.4 * lowpass(noise(0.2, seed=12), 700) * fade(0.2, 25)
    return normalize(mix(0.6 * whoosh, delayed(thump, 0.2)), 0.8)
