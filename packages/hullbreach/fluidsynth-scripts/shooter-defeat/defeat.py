from song import Song, chord

# The defeat lament, about 12 s at 60 beats per minute: a choir and low
# strings sinking through A minor, F and D minor to an empty fifth, with a
# muffled timpani stroke at each step.


def defeat():
    song = Song(tempo=60, length=10, tail=4.0)
    choir = song.track(52, volume=95, reverb=110)  # choir aahs
    strings = song.track(48, volume=85, pan=50, reverb=100)  # strings
    timpani = song.track(47, volume=90, reverb=80)

    for beat, root, kind in ((0, "A3", "minor"), (2.5, "F3", "major"), (5, "D3", "minor"), (7, "A2", "power")):
        notes = chord(root, kind)
        length = 3 if beat < 7 else 4
        choir.chord(beat, notes, length, 75)
        strings.chord(beat, [notes[0] - 12, notes[0]], length, 70)
        timpani.note(beat, notes[0] - 24 if notes[0] - 24 >= 35 else notes[0] - 12, 1, 85)
    return song
