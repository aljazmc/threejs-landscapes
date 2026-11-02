import numpy

from sound import bandpass, envelope, fade, mix, noise, normalize, sine, time

# A monster hit, 0.35 s: a wet splat and a grunt-like low wobble.


def splat():
    duration = 0.35
    wet = bandpass(noise(duration, seed=9), 300, 2000) * envelope(duration, attack=0.001, decay=0.12, release=0.1)
    grunt = sine(120 + 40 * numpy.sin(2 * numpy.pi * 18 * time(duration)), duration) * fade(duration, 9)
    return normalize(mix(wet, 0.7 * grunt))
