from song import Song, chord

# The victory fanfare, about 8 s at 100 beats per minute: brass and strings
# rising through C, F and G to a held C major chord over timpani rolls.


def victory():
    song = Song(tempo=100, length=12, tail=3.0)
    brass = song.track(61, volume=105, reverb=70)  # brass section
    strings = song.track(48, volume=90, pan=40, reverb=80)  # strings
    timpani = song.track(47, volume=100, pan=70, reverb=60)

    for beat, root, kind, length in ((0, "C3", "major", 1.5), (1.5, "C3", "major", 0.5), (2, "F3", "major", 2),
                                     (4, "G3", "major", 2), (6, "C4", "major", 6)):
        notes = chord(root, kind)
        brass.chord(beat, notes + [notes[0] + 12], length, 100)
        strings.chord(beat, [n + 12 for n in notes], length, 85)
    for k in range(12):
        timpani.note(6 + k * 0.125, "C2", 0.12, 60 + 3 * k)
    timpani.note(0, "C2", 1, 110).note(4, "G1", 1, 105)
    return song
