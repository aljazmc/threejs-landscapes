"""The package is wired into the monorepo as packages/starter/README.md
describes for a new package. It reads its own folder name, so it holds for a
copy of the starter unchanged. Needs only the standard library."""

import json
import unittest
from pathlib import Path

PACKAGE = Path(__file__).resolve().parents[2]
ROOT = PACKAGE.parents[1]
NAME = PACKAGE.name


def read(path):
    return json.loads(path.read_text())


class PackageTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.package = read(PACKAGE / "package.json")
        cls.root = read(ROOT / "package.json")
        cls.tsconfig = read(ROOT / "tsconfig.json")

    def test_names_and_directory(self):
        self.assertEqual(self.package["name"], f"@aljazmc/{NAME}")
        self.assertEqual(self.package["repository"]["directory"],
                         f"packages/{NAME}")
        self.assertEqual(self.package["scripts"]["checktypes"],
                         f"yarn ct:{NAME}")

    def test_root_scripts(self):
        self.assertEqual(self.root["dependencies"][f"@aljazmc/{NAME}"],
                         "workspace:*")
        for script in ("b", "bp", "ct", "s", "sp", "w"):
            with self.subTest(script=script):
                self.assertIn(NAME, self.root["scripts"][f"{script}:{NAME}"])

    def test_root_tsconfig(self):
        options = self.tsconfig["compilerOptions"]
        self.assertEqual(options["paths"][f"@aljazmc/{NAME}"],
                         [f"./packages/{NAME}"])
        self.assertIn({"path": f"./packages/{NAME}"},
                      self.tsconfig["references"])

    def test_tests_layout(self):
        tests = PACKAGE / "tests"
        self.assertEqual(sorted(tests.glob("*.test.ts")), [],
                         "TypeScript tests go in tests/ts")
        self.assertTrue(list((tests / "ts").glob("*.test.ts")))
        self.assertTrue(list((tests / "py").glob("test_*.py")))


if __name__ == "__main__":
    unittest.main()
