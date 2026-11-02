from song import Song, chord

# The fight's music, a seamless 30 s loop at 128 beats per minute: driving drums, a
# sixteenth-note synth bass ostinato in E minor, stabs of a square lead and
# a dark pad, in two halves (the lead riff only in the second).

PROGRESSION = [("E2", "minor"), ("C2", "major"), ("D2", "major"), ("B1", "minor")]
KICK, SNARE, HAT, OPEN, CRASH = 36, 38, 42, 46, 49


def combat():
    song = Song(tempo=128, length=64, loop=True)
    drums = song.track(0, volume=110, reverb=30, drums=True)
    bass = song.track(38, volume=105, reverb=10)  # synth bass
    pad = song.track(90, volume=70, reverb=80, chorus=50)  # polysynth pad
    lead = song.track(80, volume=80, pan=80, reverb=60)  # square lead

    for bar in range(16):
        beat = bar * 4
        root, kind = PROGRESSION[(bar // 2) % 4]
        notes = chord(root, kind)
        pad.chord(beat, [n + 24 for n in notes], 4, 55)
        for k in range(16):
            octave = 12 if k % 4 == 2 else 0
            bass.note(beat + k * 0.25, notes[0] + octave, 0.22, 95 if k % 4 == 0 else 70)
        for k in range(4):
            drums.note(beat + k, KICK, 0.25, 110)
            if k in (1, 3):
                drums.note(beat + k, SNARE, 0.25, 100)
            for h in range(2):
                drums.note(beat + k + h * 0.5, OPEN if (k, h) == (3, 1) else HAT, 0.2, 70 + 15 * h)
        if bar % 4 == 3:
            for k in range(4):
                drums.note(beat + 3 + k * 0.25, SNARE, 0.2, 70 + 10 * k)
        if bar % 8 == 0:
            drums.note(beat, CRASH, 1, 100)
        if bar >= 8:
            for k, step in enumerate([0, 0, 2, 1, 0, 2, 1, 2]):
                if k in (1, 5):
                    continue
                lead.note(beat + k * 0.5, notes[step] + 36, 0.4, 85)
    return song
