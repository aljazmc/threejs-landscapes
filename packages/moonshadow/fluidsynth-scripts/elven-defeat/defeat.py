from song import Song, chord

# The defeat, about 12 s at 60 beats per minute: a lone flute over a
# choir sinking from B minor to a bare fifth.


def defeat():
    song = Song(tempo=60, length=10, tail=4.0)
    choir = song.track(52, volume=90, reverb=110)
    flute = song.track(73, volume=85, reverb=90)
    for beat, root, kind in ((0, "B2", "minor"), (2.5, "G2", "major"), (5, "E2", "minor"), (7, "B1", "power")):
        choir.chord(beat, [n + 12 for n in chord(root, kind)], 3 if beat < 7 else 4, 70)
    for beat, n, length in ((0, "F#5", 1), (1, "D5", 1.5), (2.5, "B4", 1), (3.5, "D5", 1.5), (5, "C#5", 1),
                            (6, "B4", 1), (7, "B4", 3)):
        flute.note(beat, n, length, 75)
    return song
