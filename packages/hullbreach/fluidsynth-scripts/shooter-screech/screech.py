import numpy

from sound import drive, envelope, mix, noise, normalize, resonant, saw, sweep, time, highpass

# An alien's death screech, 1.3 s: a shrill saw cry with a fast tremble,
# falling and choking off, roughened by distortion and breathy noise.


def screech():
    duration = 1.3
    pitch = sweep(950, 140, duration, curve=1.6) * (1 + 0.05 * numpy.sin(2 * numpy.pi * 17 * time(duration)))
    cry = mix(saw(pitch, duration), 0.6 * saw(pitch * 1.49, duration))
    voice = resonant(cry, pitch * 4, q=3.0)
    breath = highpass(noise(duration, seed=31), 2000) * 0.3
    shape = envelope(duration, attack=0.02, decay=0.3, sustain=0.6, hold=0.6, release=0.35)
    return normalize(drive(mix(voice, breath) * shape, 3.0), 0.8)
