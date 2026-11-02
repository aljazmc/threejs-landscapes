from sound import delayed, envelope, mix, normalize, sine

# The main menu's selection blip, 0.12 s: two short rising sine tones, as
# on the ship's consoles.


def click():
    blip = lambda f: sine(f, 0.05) * envelope(0.05, attack=0.002, decay=0.04, release=0.008)
    return normalize(mix(blip(1320), delayed(blip(1980), 0.05)), 0.5)
