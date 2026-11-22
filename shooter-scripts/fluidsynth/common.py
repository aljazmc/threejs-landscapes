"""Finds the package whose sounds are built and the project to build.

shooter-scripts/project.sh runs export.py from the package directory, so
the working directory is the package (or SHOOTER_PACKAGE when set), and
the projects are in its fluidsynth-scripts/.
"""

import importlib
import os
import sys

root_dir = os.path.abspath(os.environ.get("SHOOTER_PACKAGE", os.getcwd()))
scripts_dir = os.path.join(root_dir, "fluidsynth-scripts")
if not os.path.isdir(scripts_dir):
    sys.exit(f"no fluidsynth-scripts in {root_dir}: run it from a package")
sys.path.insert(0, scripts_dir)


def load_project(target):
    """Build the sound of the project passed as the first argument and return
    what its function returned (samples or a Song) with the output path
    (without extension) inside the package-level target directory.

    A project fluidsynth-scripts/<theme>-<name>/ must provide <name>.py with a
    <name>() function, e.g. fluidsynth-scripts/gothic-revolver/revolver.py:revolver().
    """
    if len(sys.argv) < 2:
        sys.exit("usage: python3 shooter-scripts/fluidsynth/export.py <project> [ogg] [wav]")

    project = sys.argv[1]
    project_dir = os.path.join(scripts_dir, project)
    if not os.path.isdir(project_dir):
        sys.exit(f"project not found: {project_dir}")

    name = project.rsplit("-", 1)[-1]
    sys.path.insert(0, project_dir)
    result = getattr(importlib.import_module(name), name)()

    target_dir = os.path.join(root_dir, target)
    os.makedirs(target_dir, exist_ok=True)

    return result, os.path.join(target_dir, project)
