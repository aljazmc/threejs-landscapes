from sound import delayed, envelope, fade, highpass, lowpass, mix, noise, normalize, sine, sweep

# A creature's claws or fangs striking, 0.4 s: a swish and a slashing rip.


def claw():
    swish = lowpass(highpass(noise(0.25, seed=9), sweep(500, 3000, 0.25)), 5000) * envelope(0.25, attack=0.15,
        decay=0.08, release=0.02)
    rip = lowpass(highpass(noise(0.12, seed=10), 1500), 6000) * fade(0.12, 25)
    thump = sine(sweep(110, 60, 0.12), 0.12) * fade(0.12, 25)
    return normalize(mix(swish, delayed(0.5 * rip + 0.6 * thump, 0.22)), 0.8)
