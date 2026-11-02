from song import Song, chord, key

# The main menu's music, about 70 s at 68 beats per minute: a slow, uneasy
# drift through deep space. A warm pad and slow strings hold minor chords
# (Am, F, Dm, E), a synth bass pulses under them, a glassy arpeggio circles
# above and a lonely saw lead sings the theme in the second half.

PROGRESSION = [("A2", "minor"), ("F2", "major"), ("D2", "minor"), ("E2", "major")]


def theme():
    song = Song(tempo=68, length=80, tail=4.0)
    pad = song.track(89, volume=90, reverb=90, chorus=60)  # warm pad
    strings = song.track(49, volume=80, pan=40, reverb=100)  # slow strings
    bass = song.track(38, volume=95, reverb=20)  # synth bass
    arp = song.track(98, volume=70, pan=90, reverb=110, chorus=40)  # crystal
    lead = song.track(81, volume=75, pan=70, reverb=100, chorus=30)  # saw lead

    for bar in range(20):
        root, kind = PROGRESSION[bar % 4]
        beat = bar * 4
        notes = chord(root, kind)
        pad.chord(beat, [n + 12 for n in notes], 4, 60)
        if bar >= 4:
            strings.chord(beat, [n + 24 for n in notes], 4, 50)
        for k in range(4):
            bass.note(beat + k, notes[0], 0.9, 80 if k == 0 else 60)
        if bar >= 2:
            for k, step in enumerate([0, 1, 2, 1, 2, 0, 1, 2]):
                arp.note(beat + k * 0.5, notes[step] + 36, 0.45, 55 + 10 * (k % 2))

    melody = ["E5", "C5", "D5", "A4", "F5", "E5", "D5", "C5", "B4", "C5", "D5", "E5", "A4", "B4", "G#4", "E4"]
    for k, n in enumerate(melody):
        lead.note(32 + k * 2, key(n), 1.9, 70)
    for k, n in enumerate(melody):
        lead.note(64 + k, key(n) - 12 if k >= 12 else key(n), 0.95, 60)
    return song
