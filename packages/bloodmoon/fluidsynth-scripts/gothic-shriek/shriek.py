import numpy

from sound import delayed, drive, envelope, highpass, mix, noise, normalize, resonant, saw, sweep, time

# A creature of the night destroyed, 1.4 s: a piercing shriek with a
# tremble, falling and fading into a ghostly hiss of ashes.


def shriek():
    duration = 1.4
    pitch = sweep(1300, 220, duration, curve=1.8) * (1 + 0.04 * numpy.sin(2 * numpy.pi * 13 * time(duration)))
    cry = mix(saw(pitch, duration), 0.5 * saw(pitch * 1.5, duration))
    voice = resonant(cry, pitch * 3, q=4.0) * envelope(duration, attack=0.03, decay=0.3, sustain=0.6, hold=0.6,
        release=0.4)
    ashes = highpass(noise(1.0, seed=8), 3000) * envelope(1.0, attack=0.3, decay=0.4, sustain=0.2, release=0.3)
    return normalize(mix(drive(voice, 1.4), delayed(0.25 * ashes, 0.5)), 0.8)
