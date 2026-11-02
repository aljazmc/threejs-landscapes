from song import Song, chord

# The fight's music, a seamless 30 s loop at 128 beats per minute: a
# driving harpsichord ostinato in A minor (Am, F, Dm, E), stabbing strings,
# pounding timpani and an organ in the second half.

PROGRESSION = [("A2", "minor"), ("F2", "major"), ("D2", "minor"), ("E2", "major")]


def combat():
    song = Song(tempo=128, length=64, loop=True)
    harpsichord = song.track(6, volume=95, pan=40, reverb=50)
    strings = song.track(48, volume=90, pan=80, reverb=60)
    timpani = song.track(47, volume=105, reverb=60)
    organ = song.track(19, volume=75, reverb=90)
    bass = song.track(43, volume=90, reverb=40)  # contrabass

    for bar in range(16):
        beat = bar * 4
        root, kind = PROGRESSION[(bar // 2) % 4]
        notes = chord(root, kind)
        for k in range(16):
            harpsichord.note(beat + k * 0.25, notes[[0, 2, 1, 2][k % 4]] + 24 + (12 if k % 8 == 6 else 0), 0.24, 85)
        strings.chord(beat, [n + 12 for n in notes], 0.5, 100).chord(beat + 1.5, [n + 12 for n in notes], 0.5, 90)
        bass.note(beat, notes[0] - 12, 2, 90).note(beat + 2, notes[0] - 12, 2, 85)
        timpani.note(beat, notes[0] - 12 if notes[0] - 12 >= 35 else notes[0], 0.5, 110)
        timpani.note(beat + 2, notes[0] - 12 if notes[0] - 12 >= 35 else notes[0], 0.5, 90)
        if bar >= 8:
            organ.chord(beat, [n + 12 for n in notes], 4, 70)
    return song
