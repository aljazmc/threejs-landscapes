from sound import fade, lowpass, mix, noise, normalize, sine

# A light footstep on stone, 0.15 s.


def step():
    tap = lowpass(noise(0.15, seed=14), 1200) * fade(0.15, 40)
    return normalize(mix(tap, 0.2 * sine(220, 0.15) * fade(0.15, 50)), 0.5)
