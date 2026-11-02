from sound import delayed, envelope, fade, highpass, lowpass, mix, noise, normalize, sine, sweep

# An alien's claw strike, 0.4 s: a swish of air rising in pitch as the claw
# swings, then the scrape and click of it striking armor.


def claw():
    swish = lowpass(highpass(noise(0.25, seed=21), sweep(600, 3500, 0.25)), 5000) * envelope(0.25, attack=0.15, decay=0.08,
        release=0.02)
    click = mix(*(sine(f, 0.15) * fade(0.15, 35) for f in (2100, 3300, 4700)))
    scrape = highpass(noise(0.12, seed=22), 2500) * fade(0.12, 25)
    return normalize(mix(swish, delayed(0.6 * click, 0.2), delayed(0.4 * scrape, 0.2)))
