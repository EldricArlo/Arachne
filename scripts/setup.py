#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Environment installation and automated setup script.

This script automatically performs the following tasks:
1. Checks if the Python and Node.js versions meet the requirements.
2. Creates the necessary 'downloads' and 'logs' directories for the project.
3. Installs all Python dependencies defined in requirements.txt.
4. Checks if Node.js dependencies exist and are up-to-date, otherwise runs installation.
5. Checks if FFmpeg is installed and provides installation guidance.

How to run:
In the project's root directory, open a terminal and execute:
python scripts/setup.py
"""

import os
import sys
import subprocess
import platform
from pathlib import Path

# --- Core Fix: Dynamically calculate the project root directory ---
PROJECT_ROOT = Path(__file__).resolve().parent.parent


def run_command(command: str, description: str, cwd: Path = PROJECT_ROOT):
    """
    Run a shell command and provide clear log output.

    Args:
        command (str): The command string to execute.
        description (str): A description of what this command is doing.
        cwd (Path): The execution directory for the command, defaults to the project root.
    """
    print("\n" + "=" * 50)
    print(f"▶️  {description}...")
    print(f"   Executing command in directory '{cwd}': {command}")
    print("=" * 50)

    try:
        subprocess.run(command, shell=True, check=True, text=True, cwd=cwd)
        print(f"✅ {description} successful!")
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ {description} failed. Return code: {e.returncode}")
        print(f"   Error output: {e.stderr}")
        return False
    except FileNotFoundError:
        cmd_name = command.split()[0]
        print(
            f"❌ Command '{cmd_name}' not found. Please ensure it is installed and in the system's PATH environment variable."
        )
        return False


def check_python_version():
    """Check if the Python version is >= 3.8."""
    print("--- Checking Python version ---")
    version = sys.version_info
    if version.major < 3 or (version.major == 3 and version.minor < 8):
        print(
            f"❌ Python 3.8 or higher is required, current version: {platform.python_version()}"
        )
        return False
    print(f"✅ Python version meets requirements: {platform.python_version()}")
    return True


def check_node_version():
    """Check if Node.js is installed."""
    print("\n--- Checking Node.js version ---")
    try:
        result = subprocess.run(
            ["node", "--version"], capture_output=True, text=True, check=True
        )
        print(f"✅ Node.js is installed, version: {result.stdout.strip()}")
        return True
    except (subprocess.CalledProcessError, FileNotFoundError):
        print(
            "❌ Node.js is not installed or not in PATH. Please visit https://nodejs.org/ to download and install the LTS version."
        )
        return False


def install_python_dependencies():
    """Install dependencies from requirements.txt using pip."""
    requirements_file = PROJECT_ROOT / "requirements.txt"
    if not requirements_file.exists():
        print(
            f"❌ Dependency file {requirements_file} does not exist, cannot install Python dependencies."
        )
        return False

    pip_executable = f'"{sys.executable}" -m pip'
    run_command(f"{pip_executable} install --upgrade pip", "Upgrading pip")
    return run_command(
        f'{pip_executable} install -r "{requirements_file}"',
        "Installing Python dependencies",
    )


# --- Core Modification: Implement smart check for Node.js dependencies ---
def install_node_dependencies():
    """
    Check if Node.js dependencies are up-to-date and install if necessary.

    If the 'node_modules' directory does not exist, or if 'package.json' has
    been modified more recently than 'node_modules', it executes 'npm install'.
    Otherwise, it skips the installation to save time.
    """
    package_json_path = PROJECT_ROOT / "package.json"
    node_modules_path = PROJECT_ROOT / "node_modules"

    if not package_json_path.exists():
        print(
            f"❌ {package_json_path} file does not exist, cannot install Node.js dependencies."
        )
        return False

    # Check if the node_modules directory exists
    if node_modules_path.is_dir():
        try:
            # Get the last modification times of package.json and node_modules
            package_mod_time = package_json_path.stat().st_mtime
            node_modules_mod_time = node_modules_path.stat().st_mtime

            # If package.json has not been modified, dependencies are considered up-to-date
            if package_mod_time < node_modules_mod_time:
                print("\n" + "=" * 50)
                print("▶️  Checking Node.js dependencies...")
                print(
                    f"✅ 'node_modules' directory already exists and is up-to-date, skipping installation."
                )
                print("=" * 50)
                return True
        except FileNotFoundError:
            # If a file disappears during the check, proceed with installation
            pass

    # If node_modules does not exist, or it's older than package.json, run install
    return run_command(
        "npm install", "Installing/Updating Node.js dependencies", cwd=PROJECT_ROOT
    )


def check_ffmpeg():
    """Check if FFmpeg is installed and available in the system's PATH."""
    print("\n--- Checking FFmpeg ---")
    try:
        is_windows = platform.system() == "Windows"
        subprocess.run(
            ["ffmpeg", "-version"],
            capture_output=True,
            text=True,
            check=True,
            shell=is_windows,
        )
        print("✅ FFmpeg is installed and in the system PATH.")
        return True
    except (subprocess.CalledProcessError, FileNotFoundError):
        print(
            "⚠️  FFmpeg not found. It is a core component for merging audio/video and format conversion."
        )
        return False


def install_ffmpeg_instructions():
    """Display installation instructions for FFmpeg based on the operating system."""
    system = platform.system().lower()

    print("\n" + "=" * 50)
    print(" FFmpeg Installation Instructions")
    print("=" * 50)

    if system == "darwin":  # macOS
        print("For macOS users, it's recommended to use Homebrew:")
        print("   brew install ffmpeg")
    elif system == "linux":
        print("For Linux users, please use your package manager:")
        print("   Ubuntu/Debian: sudo apt update && sudo apt install ffmpeg")
        print("   Fedora/CentOS: sudo dnf install ffmpeg")
        print("   Arch Linux:    sudo pacman -S ffmpeg")
    elif system == "windows":
        print("For Windows users, it's recommended to use a package manager:")
        print("   Scoop:    scoop install ffmpeg")
        print("   Chocolatey: choco install ffmpeg")
        print("\nAlternatively, you can install it manually:")
        print("1. Download from the official website: https://ffmpeg.org/download.html")
        print(
            "2. After unzipping, add the full path to the 'bin' directory to your system's 'Path' environment variable."
        )

    print("=" * 50 + "\n")


def create_directories():
    """Create the directories required for the application to run."""
    print("\n--- Creating project directories ---")
    for dir_name in ["downloads", "logs"]:
        dir_path = PROJECT_ROOT / dir_name
        try:
            dir_path.mkdir(exist_ok=True)
            print(f"✅ Directory confirmed: {dir_path}")
        except OSError as e:
            print(f"❌ Failed to create directory {dir_path}: {e}")
            return False
    return True


def main():
    """Run all setup steps in sequence."""
    print("--- Starting environment setup ---")

    all_ok = (
        check_python_version()
        and check_node_version()
        and create_directories()
        and install_python_dependencies()
        and install_node_dependencies()
    )

    if not all_ok:
        print(
            "\n❌ An error occurred during environment setup. Please check the error messages above and try again after resolving."
        )
        sys.exit(1)

    if not check_ffmpeg():
        install_ffmpeg_instructions()

    print("\n🎉 Environment setup completed successfully!")
    print("You can now start the application using 'npm start' or 'npm run dev'.")


if __name__ == "__main__":
    if (
        not (PROJECT_ROOT / "frontend").is_dir()
        or not (PROJECT_ROOT / "backend").is_dir()
    ):
        print(
            f"❌ Error: This script does not seem to be in the expected project structure."
        )
        print(
            f"   Please ensure that the 'frontend' and 'backend' directories are at the same level as the 'scripts' directory."
        )
        print(f"   Detected project root: {PROJECT_ROOT}")
        sys.exit(1)

    main()