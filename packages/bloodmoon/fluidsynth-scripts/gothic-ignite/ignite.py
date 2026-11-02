from sound import bandpass, envelope, lowpass, mix, noise, normalize, sweep

# The flamethrower lighting, 0.4 s: a whoomp of catching fuel.


def ignite():
    whoomp = lowpass(noise(0.4, seed=3), sweep(300, 3000, 0.4, curve=0.4)) * envelope(0.4, attack=0.06, decay=0.25,
        sustain=0.4, release=0.08)
    hiss = bandpass(noise(0.15, seed=4), 3000, 8000) * envelope(0.15, attack=0.001, decay=0.12, release=0.03)
    return normalize(mix(whoomp, 0.3 * hiss), 0.7)
