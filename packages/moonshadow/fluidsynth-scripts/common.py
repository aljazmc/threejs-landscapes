import importlib
import os
import sys

scripts_dir = os.path.dirname(os.path.abspath(__file__))
root_dir = os.path.dirname(scripts_dir)


def load_project(target):
    """Build the sound of the project passed as the first argument and return
    what its function returned (samples or a Song) with the output path
    (without extension) inside the package-level target directory.

    A project fluidsynth-scripts/<theme>-<name>/ must provide <name>.py with a
    <name>() function, e.g. fluidsynth-scripts/elven-sword/sword.py:sword().
    """
    if len(sys.argv) < 2:
        sys.exit("usage: python3 fluidsynth-scripts/export.py <project>")

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
