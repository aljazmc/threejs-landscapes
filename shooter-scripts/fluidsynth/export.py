import os
import sys

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from common import load_project
from song import Song, write_ogg
from sound import write_wav

# usage: python3 export.py <project> [ogg] [wav]
#
# A project returns either samples (a numpy array of floats from -1 to 1 at
# sound.RATE) or a Song, which FluidSynth renders to
# src/res/<theme>-<name>.ogg (project.sh adds the music's .mp3 for Safari,
# which decodes no Ogg Vorbis). Samples are written in the formats named
# after the project (by project.sh from the package's EFFECTS), WAV when
# none are named.
result, output = load_project("src/res")
formats = sys.argv[2:] or ["wav"]

if isinstance(result, Song):
    result.render(output + ".ogg")
else:
    if "ogg" in formats:
        write_ogg(result, output + ".ogg")
    if "wav" in formats:
        write_wav(result, output + ".wav")
