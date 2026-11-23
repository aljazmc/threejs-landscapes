"""The ten monsters of blender-scripts/elven-<kind>: built in Blender and
merged as for their GLB export, each keeps the joints the game moves, and
src/game/rig.ts takes every one of them as a joint. Needs Blender's bpy:

    blender -b --factory-startup --python-exit-code 1 -P pytests.py -- moonshadow
"""

import importlib
import re
import sys
import unittest
from pathlib import Path

try:
    import bpy
except ImportError:
    bpy = None

PACKAGE = Path(__file__).resolve().parents[3]
ROOT = PACKAGE.parents[1]
SCRIPTS = PACKAGE / "blender-scripts"
# joints the game only looks for (view.ts: a Hover joint makes it float)
MARKERS = {"Hover"}
KINDS = ["goblin", "golem", "minotaur", "ogre", "orc", "skeleton", "spider",
         "troll", "warg", "wraith"]


def rig_joints():
    """animated() of src/game/rig.ts, read from its source."""
    source = (PACKAGE / "src/game/rig.ts").read_text()
    body = source[source.index("function animated"):
                  source.index("export interface Rig")]
    names, rest = body.split(".includes(name)")
    prefixes = rest.split(".some(")[0]
    names = set(re.findall(r'"([^"]+)"', names))
    prefixes = re.findall(r'"([^"]+)"', prefixes)
    return lambda name: name in names or (
        any(name.startswith(p) for p in prefixes)
        and not name.endswith(" Mesh"))


@unittest.skipIf(bpy is None, "needs Blender's bpy")
class MonsterJointsTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        sys.path[:0] = [str(SCRIPTS), str(ROOT / "shooter-scripts/blender")]
        cls.shooter = importlib.import_module("shooter")
        cls.animated = staticmethod(rig_joints())

    def build(self, kind):
        """The monster as exportglb.py leaves it: its joints only."""
        project = SCRIPTS / f"elven-{kind}"
        sys.path.insert(0, str(project))
        getattr(importlib.import_module(kind), kind)()
        self.shooter.merge_model()
        return {o.name: o for o in bpy.data.objects if o.type == "EMPTY"}

    def test_every_monster_has_a_project(self):
        monsters = importlib.import_module("monsters")
        for kind in KINDS:
            with self.subTest(kind=kind):
                self.assertTrue((SCRIPTS / f"elven-{kind}").is_dir())
                self.assertTrue(callable(getattr(monsters, kind, None)))

    def test_joints(self):
        for kind in KINDS:
            with self.subTest(kind=kind):
                joints = self.build(kind)
                self.assertIn("Body", joints)
                for name, joint in joints.items():
                    self.assertRegex(name, self.shooter.ANIMATED)
                    self.assertTrue(self.animated(name),
                                    f"rig.ts doesn't move {name!r}")
                    if name not in MARKERS:
                        self.assertTrue(joint.children,
                                        f"{name!r} moves nothing")
                legs = {re.sub(r" (Knee|Down)$", "", n) for n in joints
                        if n.startswith("Leg")}
                if legs:
                    a = {n for n in legs if n.startswith("LegA")}
                    self.assertEqual(len(a), len(legs) - len(a),
                                     "legs not in A/B pairs")
                else:
                    self.assertIn("Hover", joints, "no legs and no Hover")


if __name__ == "__main__":
    unittest.main()
