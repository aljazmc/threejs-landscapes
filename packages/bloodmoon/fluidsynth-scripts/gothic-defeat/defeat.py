from song import Song, chord

# The hunter fallen, about 12 s at 60 beats per minute: a low organ and
# choir sinking into darkness, a single bell tolling.


def defeat():
    song = Song(tempo=60, length=9, tail=5.0)
    organ = song.track(19, volume=90, reverb=110)
    choir = song.track(52, volume=80, reverb=120)
    bell = song.track(14, volume=85, reverb=110)
    for beat, root, kind in ((0, "D3", "minor"), (3, "Bb2", "major"), (6, "D2", "power")):
        notes = chord(root, kind)
        organ.chord(beat, [notes[0] - 12] + notes, 3, 85)
        choir.chord(beat, [n + 12 for n in notes], 3, 70)
    for beat in (0, 3, 6):
        bell.note(beat, "D4", 3, 80)
    return song
