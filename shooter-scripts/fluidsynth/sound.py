"""Shared helpers for sound effects synthesized with numpy: oscillators and
noise, plucked strings and struck metal, envelopes, filters, distortion and
echo, and the WAV writer.

A sound is a mono numpy array of floats from -1 to 1 at RATE samples per
second. Times are in seconds, frequencies in Hz; a frequency may be a number
or an array of the sound's length (a sweep). Random sounds take a seed, so
the same script always writes the same file.
"""

import wave

import numpy

RATE = 44100


def time(duration):
    """The sample times of a sound duration seconds long."""
    return numpy.arange(int(duration * RATE)) / RATE


def phase(frequency, duration):
    """The running phase (in cycles) of a tone whose frequency may change."""
    frequency = numpy.broadcast_to(numpy.asarray(frequency, dtype=float), (int(duration * RATE),))
    return numpy.cumsum(frequency) / RATE


def sine(frequency, duration):
    return numpy.sin(2 * numpy.pi * phase(frequency, duration))


def square(frequency, duration, duty=0.5):
    return numpy.where(phase(frequency, duration) % 1.0 < duty, 1.0, -1.0)


def saw(frequency, duration):
    return 2.0 * (phase(frequency, duration) % 1.0) - 1.0


def triangle(frequency, duration):
    return 2.0 * numpy.abs(saw(frequency, duration)) - 1.0


def noise(duration, seed=1):
    return numpy.random.default_rng(seed).uniform(-1.0, 1.0, int(duration * RATE))


def sweep(start, end, duration, curve=1.0):
    """A frequency gliding from start to end (exponentially, as the ear hears
    pitch); curve > 1 lingers near the start, < 1 hurries away from it."""
    t = numpy.linspace(0.0, 1.0, int(duration * RATE)) ** curve
    return start * (end / start) ** t


def envelope(duration, attack=0.005, decay=0.1, sustain=0.0, release=0.05, hold=0.0):
    """Attack, decay to the sustain level, hold, then release to silence,
    stretched or cut to duration."""
    parts = [numpy.linspace(0.0, 1.0, max(1, int(attack * RATE)), endpoint=False),
             numpy.linspace(1.0, sustain, max(1, int(decay * RATE)), endpoint=False),
             numpy.full(int(hold * RATE), sustain),
             numpy.linspace(sustain, 0.0, max(1, int(release * RATE)))]
    shape = numpy.concatenate(parts)
    length = int(duration * RATE)
    if len(shape) < length:
        shape = numpy.concatenate([shape, numpy.zeros(length - len(shape))])
    return shape[:length]


def fade(duration, rate):
    """Exponential decay: the level drops by e every 1/rate seconds."""
    return numpy.exp(-rate * time(duration))


def lowpass(signal, cutoff):
    """One-pole low-pass filter; cutoff may change over time (an array)."""
    cutoff = numpy.broadcast_to(numpy.asarray(cutoff, dtype=float), signal.shape)
    alpha = 1.0 - numpy.exp(-2.0 * numpy.pi * cutoff / RATE)
    out = numpy.empty_like(signal)
    level = 0.0
    for i, (sample, a) in enumerate(zip(signal, alpha)):
        level += a * (sample - level)
        out[i] = level
    return out


def highpass(signal, cutoff):
    return signal - lowpass(signal, cutoff)


def bandpass(signal, low, high):
    return lowpass(highpass(signal, low), high)


def resonant(signal, cutoff, q=4.0):
    """Two-pole resonant low-pass (a state variable filter), for the whine
    of sweeping filters; cutoff may change over time."""
    cutoff = numpy.broadcast_to(numpy.asarray(cutoff, dtype=float), signal.shape)
    f = 2.0 * numpy.sin(numpy.pi * numpy.minimum(cutoff, RATE / 6) / RATE)
    damping = 1.0 / q
    low = band = 0.0
    out = numpy.empty_like(signal)
    for i, (sample, fi) in enumerate(zip(signal, f)):
        low += fi * band
        high = sample - low - damping * band
        band += fi * high
        out[i] = low
    return out


def pluck(frequency, duration, brightness=0.5, seed=1):
    """A plucked string (Karplus-Strong): a burst of noise circulating in a
    delay line one period long, averaged a little more on every pass.
    brightness from 0 (dull) to 1 (bright) sets how slowly it mellows."""
    period = max(2, int(RATE / frequency))
    line = numpy.random.default_rng(seed).uniform(-1.0, 1.0, period)
    line -= line.mean()  # no offset, which would circulate as a slow drift
    out = numpy.empty(int(duration * RATE))
    blend = 0.5 + 0.5 * brightness
    for i in range(len(out)):
        k = i % period
        out[i] = line[k]
        line[k] = 0.996 * (blend * line[k] + (1 - blend) * line[(k + 1) % period])
    return out


def ring(partials, duration):
    """Struck metal or a bell: sine partials (frequency, level, decay rate)
    sounding together, each fading at its own rate."""
    return mix(*(level * sine(f, duration) * fade(duration, rate) for f, level, rate in partials))


def drive(signal, amount):
    """Soft clipping distortion, normalized so a full signal stays full."""
    return numpy.tanh(amount * signal) / numpy.tanh(amount)


def crush(signal, levels=16, hold=4):
    """Bit and sample rate reduction, for a harsh digital edge."""
    held = numpy.repeat(signal[::hold], hold)[:len(signal)]
    return numpy.round(held * levels) / levels


def echo(signal, delay, feedback=0.4, repeats=4):
    """Repeats of the sound, each delay seconds later and quieter, with room
    for them at the end."""
    step = int(delay * RATE)
    out = numpy.concatenate([signal, numpy.zeros(step * repeats)])
    for k in range(1, repeats + 1):
        out[k * step:k * step + len(signal)] += signal * feedback ** k
    return out


def mix(*sounds):
    """Sounds played together, padded to the longest."""
    length = max(len(s) for s in sounds)
    out = numpy.zeros(length)
    for s in sounds:
        out[:len(s)] += s
    return out


def delayed(signal, seconds):
    return numpy.concatenate([numpy.zeros(int(seconds * RATE)), signal])


def normalize(signal, peak=0.9):
    """Scaled to the peak level, with a short fade out so it ends cleanly."""
    signal = signal - numpy.mean(signal)
    top = numpy.max(numpy.abs(signal))
    if top > 0:
        signal = signal * (peak / top)
    tail = min(len(signal), int(0.005 * RATE))
    signal[len(signal) - tail:] *= numpy.linspace(1.0, 0.0, tail)
    return signal


def write_wav(signal, filepath):
    """16-bit mono PCM WAV."""
    data = (numpy.clip(signal, -1.0, 1.0) * 32767).astype("<i2")
    with wave.open(filepath, "wb") as out:
        out.setnchannels(1)
        out.setsampwidth(2)
        out.setframerate(RATE)
        out.writeframes(data.tobytes())
