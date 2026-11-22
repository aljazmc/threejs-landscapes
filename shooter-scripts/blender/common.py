"""Finds the package whose assets are built and the project to build.

shooter-scripts/project.sh runs the export scripts from the package
directory, so the working directory is the package (or SHOOTER_PACKAGE
when set). The package's blender-scripts/ comes first on the module path:
its theme modules (gothic.py, vampires.py, castlemap.py, ...) are found
there, and a module of the same name as a shared one (hullbreach's
shooter.py) is used instead of it.
"""

import importlib
import os
import sys

root_dir = os.path.abspath(os.environ.get("SHOOTER_PACKAGE", os.getcwd()))
scripts_dir = os.path.join(root_dir, "blender-scripts")
if not os.path.isdir(scripts_dir):
    sys.exit(f"no blender-scripts in {root_dir}: run it from a package")
sys.path.insert(0, scripts_dir)


def load_project(target):
    """Build the scene of the project passed after "--" and return what its
    function returned (a Sheet, or None for a model) with the output path (without
    extension) inside the package-level target directory.

    A project blender-scripts/<theme>-<name>/ must provide <name>.py with a <name>()
    function, e.g. blender-scripts/gothic-organ/organ.py:organ().
    """
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    if not args:
        sys.exit("usage: blender -b -P <script> -- <project>")

    project = args[0]
    project_dir = os.path.join(scripts_dir, project)
    if not os.path.isdir(project_dir):
        sys.exit(f"project not found: {project_dir}")

    name = project.rsplit("-", 1)[-1]
    sys.path.insert(0, project_dir)
    result = getattr(importlib.import_module(name), name)()

    target_dir = os.path.join(root_dir, target)
    os.makedirs(target_dir, exist_ok=True)

    return result, os.path.join(target_dir, project)
