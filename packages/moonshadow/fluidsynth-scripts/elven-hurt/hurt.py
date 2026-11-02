from sound import fade, lowpass, mix, noise, normalize, ring, sine, sweep

# The elf struck, 0.45 s: a thud and the faint ring of a silver mail shirt.


def hurt():
    thud = sine(sweep(120, 60, 0.3), 0.3) * fade(0.3, 14)
    knock = lowpass(noise(0.1, seed=13), 800) * fade(0.1, 40)
    mail = ring([(2900, 0.5, 25), (4100, 0.3, 30), (5300, 0.2, 35)], 0.3)
    return normalize(mix(thud, knock, 0.25 * mail))
