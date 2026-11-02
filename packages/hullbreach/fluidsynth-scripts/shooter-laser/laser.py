import numpy

from sound import echo, envelope, mix, normalize, resonant, saw, square, sweep

# The laser gun's shot, 0.3 s: a bright saw and square zap diving from a
# high whine to a low buzz through a resonant filter that follows it, with a
# short metallic echo from the ship's walls.


def laser():
    duration = 0.22
    pitch = sweep(1900, 260, duration, curve=0.6)
    tone = mix(saw(pitch, duration), 0.5 * square(pitch * 1.01, duration, duty=0.3))
    zap = resonant(tone, pitch * 3.0, q=6.0) * envelope(duration, attack=0.002, decay=0.2, release=0.02)
    return normalize(echo(zap, 0.045, feedback=0.3, repeats=3), 0.8)
