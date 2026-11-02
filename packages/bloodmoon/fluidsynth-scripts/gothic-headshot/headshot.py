from sound import bandpass, delayed, drive, envelope, fade, mix, noise, normalize, ring, sine, sweep

# A silver bullet through a creature's skull, 0.6 s: the hard crack of bone,
# a dull knock, and the high ping of the silver ringing out like a bell.


def headshot():
    crack = drive(bandpass(noise(0.06, seed=31), 1500, 8000) * envelope(0.06, attack=0.001, decay=0.05, release=0.01),
        3)
    knock = sine(sweep(220, 60, 0.12), 0.12) * fade(0.12, 25)
    ping = ring([(2093, 1.0, 6), (3140, 0.5, 8), (5230, 0.3, 12)], 0.6)
    return normalize(mix(crack, 0.7 * knock, delayed(0.35 * ping, 0.02)), 0.85)
