"""The sound effects of fluidsynth-scripts/shooter-<name>: each is a clean
mono signal, and the committed src/res/shooter-<name>.wav is what the
script writes now. The music (a Song for FluidSynth) is only built, not
played. Needs numpy."""

import importlib
import os
import sys
import tempfile
import unittest
from pathlib import Path

try:
    import numpy
except ImportError:
    numpy = None

PACKAGE = Path(__file__).resolve().parents[3]
ROOT = PACKAGE.parents[1]
SCRIPTS = PACKAGE / "fluidsynth-scripts"
PROJECTS = sorted(p.name for p in SCRIPTS.iterdir()
                  if p.is_dir() and p.name.startswith("shooter-"))


@unittest.skipIf(numpy is None, "needs numpy")
class SoundsTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        sys.path[:0] = [str(SCRIPTS), str(ROOT / "shooter-scripts/fluidsynth")]
        cls.song = importlib.import_module("song")
        cls.sound = importlib.import_module("sound")

    def build(self, project):
        name = project.rsplit("-", 1)[-1]
        sys.path.insert(0, str(SCRIPTS / project))
        return getattr(importlib.import_module(name), name)()

    def test_projects(self):
        self.assertTrue(PROJECTS)
        for project in PROJECTS:
            with self.subTest(project=project):
                result = self.build(project)
                if isinstance(result, self.song.Song):
                    continue
                self.assertEqual(result.ndim, 1)
                self.assertGreater(len(result), 0)
                self.assertTrue(numpy.all(numpy.isfinite(result)))
                self.assertLessEqual(float(numpy.max(numpy.abs(result))), 1)
                with tempfile.TemporaryDirectory() as tmp:
                    path = os.path.join(tmp, project + ".wav")
                    self.sound.write_wav(result, path)
                    written = Path(path).read_bytes()
                committed = PACKAGE / "src/res" / (project + ".wav")
                self.assertEqual(
                    written, committed.read_bytes(),
                    f"src/res/{project}.wav is out of date: "
                    "./project.sh audio")


if __name__ == "__main__":
    unittest.main()
