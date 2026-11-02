import numpy

from sound import drive, envelope, lowpass, mix, noise, normalize, resonant, saw, sweep, time

# A monster's dying roar, 1.4 s: a rough growl rising, then falling and
# choking off, through a throat-like resonant filter.


def roar():
    duration = 1.4
    rise = numpy.minimum(1.0, time(duration) / 0.3)
    pitch = (90 + 60 * rise) * sweep(1.0, 0.45, duration, curve=2.0)
    pitch = pitch * (1 + 0.04 * numpy.sin(2 * numpy.pi * 23 * time(duration)))
    growl = mix(saw(pitch, duration), 0.5 * saw(pitch * 1.01, duration))
    throat = resonant(growl, 500 + 900 * envelope(duration, attack=0.3, decay=0.6, sustain=0.3, hold=0.3,
        release=0.2), q=4.0)
    breath = lowpass(noise(duration, seed=10), 1500) * 0.3
    shape = envelope(duration, attack=0.08, decay=0.4, sustain=0.6, hold=0.5, release=0.35)
    return normalize(drive(mix(throat, breath) * shape, 2.5), 0.8)
