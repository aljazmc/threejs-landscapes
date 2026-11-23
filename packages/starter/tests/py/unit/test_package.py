"""The package is wired into the monorepo as packages/starter/README.md
describes for a new package. It reads its own folder name, so it holds for a
copy of the starter unchanged. Needs only the standard library."""

import json
import unittest
from pathlib import Path

PACKAGE = Path(__file__).resolve().parents[3]
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

    def test_e2e_server(self):
        config = (ROOT / "playwright.config.ts").read_text()
        packages = config[config.index("const PACKAGES = {"):]
        packages = packages[:packages.index("};")]
        self.assertRegex(packages, rf"\n\s+{NAME}: \d+,",
                         "the package has no port in playwright.config.ts")

    def test_tests_layout(self):
        tests = PACKAGE / "tests"
        for loose in ("*.test.ts", "ts/*.test.ts", "py/test_*.py"):
            with self.subTest(loose=loose):
                self.assertEqual(sorted(tests.glob(loose)), [],
                                 "unit tests go in tests/ts/unit and "
                                 "tests/py/unit")
        self.assertTrue(list((tests / "ts" / "unit").glob("*.test.ts")))
        self.assertTrue(list((tests / "ts" / "e2e").glob("*.e2e.ts")))
        self.assertTrue(list((tests / "py" / "unit").glob("test_*.py")))

if __name__ == "__main__":
    unittest.main()
