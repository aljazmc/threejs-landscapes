from sound import fade, lowpass, mix, noise, normalize, sine

# A footstep on the deck plates, 0.2 s: a soft boot thump and a faint ring
# of the hollow metal floor.


def step():
    thump = lowpass(noise(0.2, seed=51), 600) * fade(0.2, 30)
    ring = mix(*(sine(f, 0.2) * fade(0.2, 25) for f in (310, 742)))
    return normalize(mix(thump, 0.25 * ring), 0.6)
