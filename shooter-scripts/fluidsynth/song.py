"""Music written as notes and played by FluidSynth: a Song holds tracks of
notes (in beats), is written as a Standard MIDI File and rendered with the
fluidsynth command and a General MIDI soundfont. numpy then evens out its
level and, for a loop, folds the ring-out of the last notes back onto the
start, and libsndfile (the library fluidsynth writes its files with)
encodes it as OGG Vorbis.

Instruments are General MIDI program numbers (0-127, see the GM table:
48 string ensemble, 89 warm pad, 38 synth bass, ...); drums play on channel
9 with GM percussion keys (36 kick, 38 snare, 42 closed hat, ...). Notes are
MIDI keys (60 is middle C) or names like "C4", "F#3", "Bb2".
"""

import ctypes
import ctypes.util
import os
import shutil
import struct
import subprocess
import tempfile
import wave

import numpy

TICKS = 480  # per beat
RATE = 44100
SOUNDFONTS = [
    "/usr/share/sounds/sf2/FluidR3_GM.sf2",
    "/usr/share/sounds/sf2/default-GM.sf2",
    "/usr/share/sounds/sf2/TimGM6mb.sf2",
]

NAMES = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}


def key(note):
    """A MIDI key from a number or a name like "C4", "F#3" or "Bb2"."""
    if isinstance(note, int):
        return note
    value = NAMES[note[0].upper()]
    rest = note[1:]
    while rest and rest[0] in "#b":
        value += 1 if rest[0] == "#" else -1
        rest = rest[1:]
    return value + 12 * (int(rest) + 1)


def chord(root, kind="minor"):
    """The keys of a triad (or seventh) on root."""
    steps = {"major": (0, 4, 7), "minor": (0, 3, 7), "dim": (0, 3, 6), "sus": (0, 5, 7),
             "minor7": (0, 3, 7, 10), "power": (0, 7, 12)}[kind]
    return [key(root) + s for s in steps]


class Track:
    def __init__(self, channel, program, volume, pan, reverb, chorus):
        self.channel = channel
        self.program = program
        self.controls = {7: volume, 10: pan, 91: reverb, 93: chorus}
        self.notes = []  # (start beat, key, length in beats, velocity)

    def note(self, beat, note, length=1.0, velocity=90):
        self.notes.append((beat, key(note), length, velocity))
        return self

    def chord(self, beat, notes, length=1.0, velocity=80):
        for n in notes:
            self.note(beat, n, length, velocity)
        return self

    def events(self):
        """(tick, order, bytes) of the setup and the notes; at the same tick a
        note ends before the next one starts."""
        status = self.channel
        out = [(0, 0, bytes([0xC0 | status, self.program]))]
        out += [(0, 0, bytes([0xB0 | status, control, value])) for control, value in self.controls.items()]
        for beat, k, length, velocity in self.notes:
            start = round(beat * TICKS)
            end = max(start + 1, round((beat + length) * TICKS))
            out.append((start, 2, bytes([0x90 | status, k, velocity])))
            out.append((end, 1, bytes([0x80 | status, k, 0])))
        return sorted(out, key=lambda e: (e[0], e[1]))


class Song:
    def __init__(self, tempo, length, tail=2.0, loop=False, peak=0.85):
        """tempo in beats per minute, length in beats; tail seconds are added
        at the end for the last notes and the reverb to fade. A loop is cut
        to exactly its length instead, its ring-out mixed into its start, so
        it repeats seamlessly. The loudest sample is scaled to peak."""
        self.tempo = tempo
        self.length = length
        self.tail = 0.0 if loop else tail
        self.loop = loop
        self.peak = peak
        self.tracks = []
        self.channels = iter([c for c in range(16) if c != 9])

    def track(self, program, volume=100, pan=64, reverb=40, chorus=0, drums=False):
        t = Track(9 if drums else next(self.channels), program, volume, pan, reverb, chorus)
        self.tracks.append(t)
        return t

    def midi(self):
        """The song as a type 1 Standard MIDI File."""
        def varlen(value):
            data = [value & 0x7F]
            value >>= 7
            while value:
                data.insert(0, (value & 0x7F) | 0x80)
                value >>= 7
            return bytes(data)

        def chunk(events, end):
            data = b""
            last = 0
            for tick, _, message in events:
                data += varlen(tick - last) + message
                last = tick
            data += varlen(max(0, end - last)) + b"\xff\x2f\x00"
            return b"MTrk" + struct.pack(">I", len(data)) + data

        end = round((self.length + self.tail * self.tempo / 60) * TICKS)
        tempo = bytes([0xFF, 0x51, 0x03]) + (60_000_000 // self.tempo).to_bytes(3, "big")
        chunks = [chunk([(0, 0, tempo)], end)] + [chunk(t.events(), end) for t in self.tracks]
        return b"MThd" + struct.pack(">IHHH", 6, 1, len(chunks), TICKS) + b"".join(chunks)

    def render(self, filepath):
        """Plays the song with fluidsynth and writes it to filepath (OGG Vorbis)."""
        fluidsynth = shutil.which("fluidsynth")
        if fluidsynth is None:
            raise SystemExit("fluidsynth is required to render music")
        soundfont = next((s for s in SOUNDFONTS if os.path.exists(s)), None)
        if soundfont is None:
            raise SystemExit("no General MIDI soundfont found in " + ", ".join(SOUNDFONTS))
        with tempfile.TemporaryDirectory() as tmp:
            midi = os.path.join(tmp, "song.mid")
            played = os.path.join(tmp, "song.wav")
            with open(midi, "wb") as file:
                file.write(self.midi())
            subprocess.run([fluidsynth, "-n", "-i", "-q", "-r", str(RATE), "-T", "wav", "-O", "s16",
                            "-F", played, soundfont, midi],
                           check=True, stdout=subprocess.DEVNULL)
            with wave.open(played) as file:
                audio = numpy.frombuffer(file.readframes(file.getnframes()), "<i2")
            audio = audio.reshape(-1, 2).astype(numpy.float32) / 32768

        if self.loop:
            frames = round(self.length * 60 / self.tempo * RATE)
            audio = numpy.concatenate([audio, numpy.zeros((max(0, frames - len(audio)), 2), numpy.float32)])
            ring = audio[frames:]
            audio = audio[:frames].copy()
            audio[:len(ring)] += ring[:frames]
        else:
            # the silence fluidsynth leaves after the reverb has faded
            loud = numpy.nonzero(numpy.abs(audio).max(axis=1) > 1e-4)[0]
            audio = audio[:loud[-1] + 1] if len(loud) else audio
        audio = remove_offset(audio, self.loop)
        top = numpy.abs(audio).max()
        if top > 0:
            audio *= self.peak / top
        write_ogg(audio, filepath)


def remove_offset(audio, loop, window=2048):
    """Subtracts a moving average (about 20 Hz and below): some soundfont
    instruments carry a DC offset that drifts as notes start and end. A loop
    is averaged across its seam, so it stays seamless."""
    pad = window // 2
    if loop:
        padded = numpy.concatenate([audio[-pad:], audio, audio[:pad]])
    else:
        padded = numpy.pad(audio, ((pad, pad), (0, 0)), mode="edge")
    total = numpy.concatenate([numpy.zeros((1, audio.shape[1])), numpy.cumsum(padded, axis=0, dtype=numpy.float64)])
    average = (total[window:window + len(audio)] - total[:len(audio)]) / window
    return (audio - average).astype(numpy.float32)


def write_ogg(audio, filepath, quality=0.6):
    """Float samples (mono) or frames (stereo) as OGG Vorbis, with libsndfile
    through ctypes."""
    name = ctypes.util.find_library("sndfile")
    if name is None:
        raise SystemExit("libsndfile is required to write OGG files")
    lib = ctypes.CDLL(name)

    class Info(ctypes.Structure):
        _fields_ = [("frames", ctypes.c_int64), ("samplerate", ctypes.c_int), ("channels", ctypes.c_int),
                    ("format", ctypes.c_int), ("sections", ctypes.c_int), ("seekable", ctypes.c_int)]

    lib.sf_open.restype = ctypes.c_void_p
    lib.sf_open.argtypes = [ctypes.c_char_p, ctypes.c_int, ctypes.POINTER(Info)]
    lib.sf_command.argtypes = [ctypes.c_void_p, ctypes.c_int, ctypes.c_void_p, ctypes.c_int]
    lib.sf_writef_float.argtypes = [ctypes.c_void_p, ctypes.c_void_p, ctypes.c_int64]
    lib.sf_writef_float.restype = ctypes.c_int64
    lib.sf_close.argtypes = [ctypes.c_void_p]
    sf_write, ogg_vorbis, vbr_quality = 0x20, 0x200000 | 0x0060, 0x1300

    info = Info(0, RATE, 1 if audio.ndim == 1 else audio.shape[1], ogg_vorbis, 0, 0)
    handle = lib.sf_open(filepath.encode(), sf_write, ctypes.byref(info))
    if not handle:
        raise SystemExit(f"cannot write {filepath}")
    level = ctypes.c_double(quality)
    lib.sf_command(handle, vbr_quality, ctypes.byref(level), ctypes.sizeof(level))
    # in blocks: libsndfile's Vorbis encoder crashes on very long single writes
    for start in range(0, len(audio), 4096):
        block = numpy.ascontiguousarray(audio[start:start + 4096], dtype=numpy.float32)
        lib.sf_writef_float(handle, block.ctypes.data, len(block))
    lib.sf_close(handle)
