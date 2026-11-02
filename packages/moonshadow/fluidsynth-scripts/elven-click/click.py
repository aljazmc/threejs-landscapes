from sound import lowpass, normalize, pluck

# The main menu's selection: a soft harp pluck, 0.4 s.


def click():
    return normalize(lowpass(pluck(880, 0.4, brightness=0.3, seed=15), 5000), 0.4)
