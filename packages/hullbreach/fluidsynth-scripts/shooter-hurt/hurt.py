from sound import envelope, fade, lowpass, mix, noise, normalize, sine, sweep

# The commando hit, 0.45 s: a dull thud on the armor and a short metallic
# ring of the suit plates (inharmonic partials).


def hurt():
    thud = sine(sweep(110, 55, 0.3), 0.3) * fade(0.3, 14)
    knock = lowpass(noise(0.08, seed=41), 900) * envelope(0.08, attack=0.001, decay=0.07, release=0.01)
    ring = mix(*(a * sine(f, 0.45) * fade(0.45, d) for f, a, d in ((523, 0.5, 9), (1347, 0.3, 12), (2311, 0.2, 16))))
    return normalize(mix(thud, knock, 0.4 * ring))
