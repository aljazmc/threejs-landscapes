import os
import sys

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from common import load_project
from sound import write_wav
from song import Song

# A project returns either samples (a numpy array of floats from -1 to 1 at
# sound.RATE), written as src/res/<theme>-<name>.wav, or a Song, which FluidSynth
# renders to src/res/<theme>-<name>.ogg.
result, output = load_project("src/res")

if isinstance(result, Song):
    result.render(output + ".ogg")
else:
    write_wav(result, output + ".wav")
