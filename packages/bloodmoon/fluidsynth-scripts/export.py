import os
import sys

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from common import load_project
from song import Song, write_ogg
from sound import write_wav

# A project returns either samples (a numpy array of floats from -1 to 1 at
# sound.RATE) or a Song, which FluidSynth renders; both are written as
# src/res/<theme>-<name>.ogg (OGG Vorbis). Samples are written as .wav too,
# for Safari, which decodes no Ogg Vorbis (project.sh adds the music's .mp3).
result, output = load_project("src/res")

if isinstance(result, Song):
    result.render(output + ".ogg")
else:
    write_ogg(result, output + ".ogg")
    write_wav(result, output + ".wav")
