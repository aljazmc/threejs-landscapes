from song import Song, chord, key

# The main menu's music, about 60 s at 80 beats per minute: an elven air in
# D mixolydian (D, C, G, D, then Bm, G, A, D). A harp rolls the chords, slow
# strings hold them and a flute sings the tune, a choir joining the second
# time.

PROGRESSION = [("D3", "major"), ("C3", "major"), ("G2", "major"), ("D3", "major"),
               ("B2", "minor"), ("G2", "major"), ("A2", "major"), ("D3", "major")]
TUNE = ["A4", "D5", "E5", "F#5", "G5", "F#5", "E5", "C5", "D5", "B4", "G4", "A4", "D5", "E5", "D5", "D5",
        "F#5", "E5", "D5", "B4", "D5", "B4", "G4", "B4", "A4", "C#5", "E5", "G5", "F#5", "E5", "D5", "D5"]


def theme():
    song = Song(tempo=80, length=80, tail=4.0)
    harp = song.track(46, volume=90, pan=40, reverb=90)
    strings = song.track(49, volume=65, pan=80, reverb=100)  # slow strings
    flute = song.track(73, volume=90, reverb=80)
    choir = song.track(52, volume=60, reverb=110)

    for bar in range(20):
        beat = bar * 4
        root, kind = PROGRESSION[bar % 8]
        notes = chord(root, kind)
        for k, step in enumerate([0, 1, 2, 1, 2, 3, 2, 1]):
            n = notes[step] if step < 3 else notes[0] + 12
            harp.note(beat + k * 0.5, n + 12, 1.5, 70)
        if bar >= 2:
            strings.chord(beat, notes, 4, 55)
        if bar >= 12:
            choir.chord(beat, [n + 12 for n in notes], 4, 50)
    for k, n in enumerate(TUNE):
        flute.note(16 + k, key(n), 0.95, 80)
        flute.note(48 + k, key(n), 0.95, 80)
    return song
