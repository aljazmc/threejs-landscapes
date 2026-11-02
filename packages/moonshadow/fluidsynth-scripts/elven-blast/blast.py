import numpy

from sound import RATE, delayed, drive, envelope, fade, lowpass, mix, noise, normalize, ring, sine, sweep

# The explosive arrow's blast, 2.5 s: a crack and a boom like the
# grenade's, with a shimmer of moon runes (bell partials) bursting out and
# stone shards pattering down.


def blast():
    duration = 2.5
    cutoff = sweep(2500, 120, duration, curve=0.5)
    roar = lowpass(lowpass(noise(duration, seed=6), cutoff), cutoff) * fade(duration, 2.2)
    crack = noise(0.03, seed=7) * fade(0.03, 120)
    boom = sine(sweep(70, 28, 1.5, curve=0.7), 1.5) * envelope(1.5, attack=0.004, decay=1.4, release=0.1)
    shimmer = ring([(1320, 1.0, 3), (1980, 0.7, 3.5), (2640, 0.5, 4), (3520, 0.4, 5)], 1.6)
    rng = numpy.random.default_rng(8)
    shards = numpy.zeros(int(duration * RATE))
    for _ in range(40):
        at = int(2.0 * rng.uniform(0.05, 1.0) ** 1.5 * RATE)
        ping = ring([(rng.uniform(2500, 5000), 1.0, 60)], 0.04) * rng.uniform(0.1, 0.4)
        shards[at:at + len(ping)] += ping
    return normalize(drive(mix(0.5 * crack, roar, 1.2 * boom, 0.15 * shimmer, 0.4 * shards), 1.5))
