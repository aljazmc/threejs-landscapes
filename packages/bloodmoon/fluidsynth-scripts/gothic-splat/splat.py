import numpy

from sound import bandpass, envelope, fade, mix, noise, normalize, sine, time

# A creature hit, 0.35 s: a wet splat of blood and a low grunt.


def splat():
    duration = 0.35
    wet = bandpass(noise(duration, seed=7), 300, 2200) * envelope(duration, attack=0.001, decay=0.12, release=0.1)
    grunt = sine(110 + 40 * numpy.sin(2 * numpy.pi * 21 * time(duration)), duration) * fade(duration, 9)
    return normalize(mix(wet, 0.6 * grunt))
