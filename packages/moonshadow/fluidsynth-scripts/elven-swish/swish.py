from sound import bandpass, envelope, noise, normalize, sweep

# The sword cutting the air, 0.25 s: a rising whoosh.


def swish():
    whoosh = bandpass(noise(0.25, seed=3), sweep(400, 2500, 0.25), 6000)
    return normalize(whoosh * envelope(0.25, attack=0.12, decay=0.11, release=0.02), 0.5)
