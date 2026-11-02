from song import Song, chord

# The fight's music, a seamless 32 s loop at 120 beats per minute: war
# drums and timpani, driving strings in E minor (Em, C, D, Bm), horn calls
# and a fierce flute in the second half.

PROGRESSION = [("E2", "minor"), ("C2", "major"), ("D2", "major"), ("B1", "minor")]
LOW_TOM, MID_TOM, HIGH_TOM, CRASH = 41, 45, 48, 49


def combat():
    song = Song(tempo=120, length=64, loop=True)
    drums = song.track(0, volume=105, reverb=60, drums=True)
    timpani = song.track(47, volume=100, reverb=60)
    strings = song.track(48, volume=90, pan=40, reverb=60)
    horns = song.track(60, volume=90, pan=80, reverb=70)
    flute = song.track(73, volume=85, reverb=70)

    for bar in range(16):
        beat = bar * 4
        root, kind = PROGRESSION[(bar // 2) % 4]
        notes = chord(root, kind)
        for k in range(8):
            strings.note(beat + k * 0.5, notes[0] + 12 + (12 if k % 4 == 3 else 0), 0.45, 90 if k % 2 == 0 else 70)
        timpani.note(beat, notes[0], 1, 105)
        for offset, tom in ((0, LOW_TOM), (1, MID_TOM), (1.5, MID_TOM), (2, LOW_TOM), (3, HIGH_TOM), (3.5, MID_TOM)):
            drums.note(beat + offset, tom, 0.3, 90)
        if bar % 8 == 0:
            drums.note(beat, CRASH, 1, 90)
        if bar >= 8:
            if bar % 2 == 0:
                horns.chord(beat, [notes[0] + 12, notes[2] + 12], 2, 95)
            for k, step in enumerate([0, 2, 1, 2]):
                flute.note(beat + k, notes[step] + 24, 0.9, 85)
    return song
