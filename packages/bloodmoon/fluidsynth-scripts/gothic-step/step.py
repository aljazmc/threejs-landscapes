import numpy

from sound import bandpass, fade, lowpass, mix, noise, normalize, sine, sweep

# A footstep on old floorboards, 0.25 s: a boot heel and a faint creak.


def step():
    heel = lowpass(noise(0.12, seed=12), 900) * fade(0.12, 40)
    creak = bandpass(numpy.sign(sine(sweep(170, 140, 0.2), 0.2)), 400, 2000) * fade(0.2, 14)
    return normalize(mix(heel, 0.12 * creak), 0.5)
