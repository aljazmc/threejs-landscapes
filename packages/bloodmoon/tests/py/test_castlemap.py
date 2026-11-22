"""The castle of blender-scripts/castlemap.py: the committed
src/res/gothic-map.txt is what layout() writes now, and the game can play
it. Needs only the standard library."""

import sys
import unittest
from pathlib import Path

PACKAGE = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(PACKAGE / "blender-scripts"))

import castlemap  # noqa: E402 (after the path to the scripts)


class CastleMapTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        lines = castlemap.layout()
        cls.lines = lines
        cls.grid = lines[:castlemap.HEIGHT]
        cls.props = [line.split() for line in lines[castlemap.HEIGHT:]]

    def floor(self, x, y):
        return self.grid[int(y)][int(x)] in castlemap.FLOORS

    def test_committed_map_is_up_to_date(self):
        committed = (PACKAGE / "src/res/gothic-map.txt").read_text()
        self.assertEqual(
            committed, "\n".join(self.lines) + "\n",
            "src/res/gothic-map.txt is out of date: ./project.sh graphics")

    def test_grid_has_the_castle_size(self):
        self.assertEqual(len(self.grid), castlemap.HEIGHT)
        for row in self.grid:
            self.assertEqual(len(row), castlemap.WIDTH)

    def test_every_floor_has_a_ceiling(self):
        used = {char for row in self.grid for char in row}
        self.assertLessEqual(used & set(castlemap.FLOORS),
                             set(castlemap.CEILING))

    def test_props_have_models(self):
        scripts = PACKAGE / "blender-scripts"
        for model in {p[0] for p in self.props
                      if p[0] not in ("player", "monster")}:
            with self.subTest(model=model):
                self.assertTrue((scripts / f"gothic-{model}").is_dir(),
                                f"no blender-scripts/gothic-{model}")

    def test_player_starts_on_the_floor(self):
        players = [p for p in self.props if p[0] == "player"]
        self.assertEqual(len(players), 1)
        _, x, y, _ = players[0]
        self.assertTrue(self.floor(float(x), float(y)))

    def test_ten_monsters_on_the_floor(self):
        monsters = [p for p in self.props if p[0] == "monster"]
        self.assertEqual([int(p[1]) for p in monsters], list(range(1, 11)))
        for _, n, x, y in monsters:
            with self.subTest(monster=n):
                self.assertTrue(self.floor(float(x), float(y)))


if __name__ == "__main__":
    unittest.main()
