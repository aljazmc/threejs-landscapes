from sound import fade, lowpass, mix, noise, normalize, sine, sweep

# The hunter wounded, 0.4 s: a heavy thud through his greatcoat.


def hurt():
    thud = sine(sweep(110, 55, 0.3), 0.3) * fade(0.3, 13)
    knock = lowpass(noise(0.12, seed=11), 700) * fade(0.12, 30)
    return normalize(mix(thud, knock))
