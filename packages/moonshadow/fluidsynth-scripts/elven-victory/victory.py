from song import Song, chord

# The victory, about 9 s at 90 beats per minute: horns and harp rising in
# D major to a held chord, the choir answering.


def victory():
    song = Song(tempo=90, length=12, tail=3.0)
    horns = song.track(60, volume=100, reverb=80)
    harp = song.track(46, volume=90, pan=40, reverb=90)
    choir = song.track(52, volume=80, reverb=110)
    for beat, n, length in ((0, "A3", 1), (1, "D4", 1), (2, "F#4", 1), (3, "A4", 1), (4, "D5", 4)):
        horns.note(beat, n, length, 100)
    for k, n in enumerate(chord("D4", "major") * 2):
        harp.note(4 + k * 0.25, n + (12 if k >= 3 else 0), 3, 80)
    choir.chord(4, chord("D4", "major"), 8, 75)
    return song
