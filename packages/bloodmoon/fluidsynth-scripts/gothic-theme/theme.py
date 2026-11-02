from song import Song, chord

# The main menu's music, about 70 s at 72 beats per minute: a gothic
# toccata on a church organ in D minor, a choir holding the chords, low
# strings and a tolling bell (tubular bells) on each phrase.

PROGRESSION = [("D3", "minor"), ("Bb2", "major"), ("G2", "minor"), ("A2", "major"),
               ("D3", "minor"), ("F2", "major"), ("C3", "major"), ("A2", "major")]


def theme():
    song = Song(tempo=72, length=80, tail=5.0)
    organ = song.track(19, volume=90, reverb=110)  # church organ
    choir = song.track(52, volume=70, reverb=120)
    strings = song.track(48, volume=75, reverb=100)
    bell = song.track(14, volume=80, reverb=110)  # tubular bells

    for bar in range(20):
        beat = bar * 4
        root, kind = PROGRESSION[bar % 8]
        notes = chord(root, kind)
        if bar < 4:
            organ.chord(beat, [notes[0] - 12] + [n + 12 for n in notes], 4, 85)
        else:
            # the toccata: a pedal note and runs over the chord
            organ.note(beat, notes[0] - 12, 4, 85)
            for k, step in enumerate([2, 1, 2, 0, 2, 1, 2, 0, 2, 1, 2, 0, 1, 0, 1, 2]):
                organ.note(beat + k * 0.25, notes[step] + 24, 0.24, 80)
        if bar >= 8:
            choir.chord(beat, [n + 12 for n in notes], 4, 60)
        strings.note(beat, notes[0] - 12, 4, 70)
        if bar % 4 == 0:
            bell.note(beat, notes[0] + 24, 3, 90)
    return song
