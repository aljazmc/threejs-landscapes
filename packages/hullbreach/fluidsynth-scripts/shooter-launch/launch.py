from sound import bandpass, delayed, envelope, fade, lowpass, mix, noise, normalize, sine, sweep

# The grenade launcher's shot, 0.5 s: a deep thump of compressed gas, a
# burst of hiss from the barrel and the clank of the next grenade sliding
# into the breech.


def launch():
    thump = sine(sweep(140, 45, 0.35, curve=0.5), 0.35) * fade(0.35, 9)
    hiss = lowpass(bandpass(noise(0.3, seed=3), 800, 4000), 4000) * envelope(0.3, attack=0.001, decay=0.25, release=0.05)
    clank = mix(*(sine(f, 0.12) * fade(0.12, 40) for f in (1250, 1870, 2790)))
    return normalize(mix(thump, 0.5 * hiss, delayed(0.25 * clank, 0.28)))
