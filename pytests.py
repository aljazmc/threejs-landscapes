"""Runs the Python tests of the packages, packages/<package>/tests/py/test_*.py,
with unittest from the standard library, so it needs no pytest.

    python3 pytests.py [package...]
    blender -b --factory-startup --python-exit-code 1 -P pytests.py -- [package...]

Without packages it runs those of every package that has tests/py, each in
a process of its own (python3, or Blender again), as the packages' scripts
share module names (castlemap, shooter, ...). Tests that need Blender's bpy
or numpy skip themselves where those are missing, so it runs with any of
Blender's, Inkscape's or FluidSynth's Python; ./project.sh pytests runs it
in the aljazmc/* images.
"""

import os
import subprocess
import sys
import unittest

try:
    import bpy
except ImportError:
    bpy = None

ROOT = os.path.dirname(os.path.abspath(__file__))
PACKAGES = os.path.join(ROOT, "packages")


def tests_of(package):
    return os.path.join(PACKAGES, package, "tests", "py")


def arguments():
    # Blender passes its own arguments before "--"
    if "--" in sys.argv:
        return sys.argv[sys.argv.index("--") + 1:]
    return [] if bpy else sys.argv[1:]


def run_each(packages):
    if bpy:
        command = [bpy.app.binary_path, "-b", "--factory-startup",
                   "--python-exit-code", "1", "-P", __file__, "--"]
    else:
        command = [sys.executable, __file__]
    failed = [p for p in packages
              if subprocess.run(command + [p]).returncode != 0]
    where = f"Blender {bpy.app.version_string}" if bpy else \
        f"Python {sys.version.split()[0]}"
    print(f"\n{len(packages) - len(failed)} of {len(packages)} packages "
          f"passed with {where}" + (f"; failed: {', '.join(failed)}"
                                    if failed else ""))
    return not failed


def run(package):
    directory = tests_of(package)
    if not os.path.isdir(directory):
        print(f"{package} has no tests/py", flush=True)
        return False
    print(f"\n=== {package}", flush=True)
    suite = unittest.defaultTestLoader.discover(
        directory, pattern="test_*.py", top_level_dir=directory)
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    return result.wasSuccessful()


def main():
    packages = arguments() or sorted(
        p for p in os.listdir(PACKAGES) if os.path.isdir(tests_of(p)))
    ok = run(packages[0]) if len(packages) == 1 else run_each(packages)
    sys.exit(0 if ok else 1)


main()
