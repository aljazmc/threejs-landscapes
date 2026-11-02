import numpy

from sound import RATE, bandpass, lowpass, mix, noise, time

# The flamethrower's fire while it burns, a seamless 2 s loop: a roaring
# rush of burning fuel with a slow flutter and crackling, its end
# crossfaded into its start so it repeats without a seam.


def flame():
    duration, overlap = 2.3, 0.3
    flutter = 1 + 0.25 * numpy.sin(2 * numpy.pi * 3.0 * time(duration)) * numpy.sin(2 * numpy.pi * 0.7 * time(duration))
    roar = lowpass(lowpass(noise(duration, seed=13), 900), 900) * flutter
    hiss = bandpass(noise(duration, seed=14), 1500, 5000) * 0.25
    rng = numpy.random.default_rng(15)
    crackle = numpy.zeros(int(duration * RATE))
    for at in rng.integers(0, len(crackle) - 200, 90):
        crackle[at:at + 60] += rng.uniform(-0.6, 0.6) * numpy.exp(-numpy.arange(60) / 10)
    sound = mix(roar, hiss, crackle)
    # the overlap at the end fades into the start
    n = int(overlap * RATE)
    ramp = numpy.linspace(0.0, 1.0, n)
    looped = sound[:len(sound) - n].copy()
    looped[:n] = looped[:n] * ramp + sound[len(sound) - n:] * (1 - ramp)
    looped -= looped.mean()
    return looped / numpy.max(numpy.abs(looped)) * 0.6
