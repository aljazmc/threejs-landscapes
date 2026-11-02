from sound import bandpass, crush, delayed, envelope, fade, mix, noise, normalize, sine, square, sweep

# A shot through an alien's head, 0.4 s: a crunch of bursting chitin, a wet
# pop, and the visor's bright two-note chirp confirming the hit.


def headshot():
    crunch = crush(bandpass(noise(0.08, seed=21), 800, 6000), 12, 3) * envelope(0.08, attack=0.001, decay=0.06,
        release=0.01)
    pop = sine(sweep(420, 90, 0.12), 0.12) * fade(0.12, 30)
    low = square(1320, 0.07) * envelope(0.07, attack=0.002, decay=0.05, release=0.01)
    high = square(1980, 0.12) * envelope(0.12, attack=0.002, decay=0.09, release=0.02)
    chirp = mix(low, delayed(high, 0.07))
    return normalize(mix(crunch, 0.8 * pop, delayed(0.3 * chirp, 0.05)), 0.85)
