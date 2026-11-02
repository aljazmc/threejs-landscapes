from song import Song, chord

# The manor cleansed, about 10 s at 80 beats per minute: the organ and
# choir rising out of D minor into a radiant D major chord, bells ringing.


def victory():
    song = Song(tempo=80, length=12, tail=4.0)
    organ = song.track(19, volume=95, reverb=110)
    choir = song.track(52, volume=85, reverb=120)
    bell = song.track(14, volume=85, reverb=110)
    for beat, root, kind, length in ((0, "D3", "minor", 2), (2, "Bb2", "major", 2), (4, "A2", "major", 2),
                                     (6, "D3", "major", 6)):
        notes = chord(root, kind)
        organ.chord(beat, [notes[0] - 12] + [n + 12 for n in notes], length, 95)
        choir.chord(beat, [n + 12 for n in notes], length, 80)
    for k, n in enumerate(["D5", "F#5", "A5", "D6"]):
        bell.note(6 + k * 0.5, n, 3, 90)
    return song
