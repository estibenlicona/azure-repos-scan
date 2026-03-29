"""Script de empaquetado con PyInstaller."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path


def build() -> None:
    """Generar ejecutable con PyInstaller."""
    root = Path(__file__).resolve().parent.parent
    entry_point = root / "src" / "azure_repos_scan" / "__main__.py"

    cmd: list[str] = [
        sys.executable,
        "-m",
        "PyInstaller",
        "--name=AzureReposScan",
        "--windowed",
        "--noconfirm",
        "--clean",
        f"--distpath={root / 'dist'}",
        f"--workpath={root / 'build'}",
        str(entry_point),
    ]

    subprocess.run(cmd, check=True, cwd=str(root))


if __name__ == "__main__":
    build()
