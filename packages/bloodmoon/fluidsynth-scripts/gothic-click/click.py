from sound import normalize, ring

# The main menu's selection, 0.6 s: a small toll of a chapel bell.


def click():
    return normalize(ring([(660, 1.0, 6), (1590, 0.6, 9), (2180, 0.4, 12), (3300, 0.2, 16)], 0.6), 0.4)
