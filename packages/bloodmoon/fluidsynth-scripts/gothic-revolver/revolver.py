from sound import bandpass, delayed, drive, envelope, fade, lowpass, mix, noise, normalize, ring, sine, sweep

# The revolver's shot, 0.9 s: a sharp report, the boom of black powder and
# its echo rolling through the castle's halls, then the click of the drum.


def revolver():
    crack = bandpass(noise(0.05, seed=1), 1200, 9000) * envelope(0.05, attack=0.001, decay=0.04, release=0.01)
    boom = mix(sine(sweep(150, 45, 0.25), 0.25) * fade(0.25, 14), 0.6 * lowpass(noise(0.3, seed=2), 1800) * fade(0.3, 14))
    shot = drive(mix(crack, boom), 2.5)
    hall = mix(delayed(0.3 * lowpass(shot, 1500), 0.12), delayed(0.15 * lowpass(shot, 900), 0.27))
    drum = ring([(2600, 1.0, 120), (4100, 0.5, 150)], 0.04)
    return normalize(mix(shot, hall, delayed(0.15 * drum, 0.45)), 0.75)
