import importlib
import os
import sys

scripts_dir = os.path.dirname(os.path.abspath(__file__))
root_dir = os.path.dirname(scripts_dir)
package_dir = os.path.dirname(root_dir)

TARGETS = {
    "models": os.path.join(package_dir, "src", "models"),
    "blend": os.path.join(root_dir, "blend"),
}


def load_project(target):
    """Build the scene of the project passed after "--" and return the output
    path (without extension) inside the target directory, which is either
    packages/ptuj/src/models or packages/ptuj/blender-scripts/blend.

    A project scripts/<theme>-<name>/ must provide <name>.py with a <name>()
    function, e.g. scripts/ptuj-castle/castle.py:castle(). Its output is
    named after <name>, so the app loads it as models/<name>.glb once the
    build has copied src/models into dist/models.
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
    getattr(importlib.import_module(name), name)()

    target_dir = TARGETS[target]
    os.makedirs(target_dir, exist_ok=True)

    return os.path.join(target_dir, name)
