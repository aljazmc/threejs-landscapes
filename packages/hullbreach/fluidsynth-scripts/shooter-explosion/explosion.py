import numpy

from sound import RATE, delayed, drive, envelope, fade, lowpass, mix, noise, normalize, sine, sweep

# The grenade's explosion, 2.5 s: a sharp crack, a roar of noise whose
# muffling closes as it fades, a sub-bass boom dropping in pitch, and
# debris crackling and pattering down.


def explosion():
    duration = 2.5
    cutoff = sweep(2500, 120, duration, curve=0.5)
    roar = lowpass(lowpass(noise(duration, seed=5), cutoff), cutoff) * fade(duration, 2.2)
    crack = noise(0.03, seed=6) * fade(0.03, 120)
    boom = sine(sweep(75, 28, 1.5, curve=0.7), 1.5) * envelope(1.5, attack=0.004, decay=1.4, release=0.1)
    rng = numpy.random.default_rng(7)
    debris = numpy.zeros(int(duration * RATE))
    for _ in range(70):
        at = int(2.2 * rng.uniform(0.02, 1.0) ** 1.6 * RATE)  # most of it early
        grain = noise(0.012, seed=int(rng.integers(1000))) * fade(0.012, 300) * rng.uniform(0.1, 0.5)
        debris[at:at + len(grain)] += grain[:len(debris) - at]
    return normalize(drive(mix(0.5 * crack, roar, 1.2 * boom, delayed(0.4 * debris, 0.05)), 1.5))
