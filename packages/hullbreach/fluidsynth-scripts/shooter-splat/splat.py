import numpy

from sound import bandpass, envelope, fade, mix, noise, normalize, sine, time

# An alien hit by a shot, 0.35 s: a wet splat of filtered noise and a
# gurgle of ichor, a low wobbling tone.


def splat():
    duration = 0.35
    wet = bandpass(noise(duration, seed=11), 300, 2200) * envelope(duration, attack=0.001, decay=0.12, release=0.1)
    wobble = 160 + 60 * numpy.sin(2 * numpy.pi * 23 * time(duration))
    gurgle = sine(wobble, duration) * fade(duration, 10)
    return normalize(mix(wet, 0.6 * gurgle))
