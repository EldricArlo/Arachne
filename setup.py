#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
安装和设置脚本
"""

import os
import sys
import subprocess
import platform
from pathlib import Path

def run_command(command, description):
    """运行命令并显示进度"""
    print(f"\n{'='*50}")
    print(f"正在{description}...")
    print(f"{'='*50}")
    
    try:
        subprocess.run(command, shell=True, check=True, text=True)
        print(f"✅ {description}成功!")
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ {description}失败: {e}")
        return False

def check_python_version():
    """检查Python版本"""
    print("检查 Python 版本...")
    version = sys.version_info
    if version.major < 3 or (version.major == 3 and version.minor < 8):
        print(f"❌ 需要 Python 3.8 或更高版本，当前版本: {version.major}.{version.minor}")
        return False
    print(f"✅ Python 版本: {version.major}.{version.minor}.{version.micro}")
    return True

def check_node_version():
    """检查Node.js版本"""
    print("检查 Node.js 版本...")
    try:
        result = subprocess.run(['node', '--version'], capture_output=True, text=True, check=True)
        print(f"✅ Node.js 版本: {result.stdout.strip()}")
        return True
    except (subprocess.CalledProcessError, FileNotFoundError):
        print("❌ Node.js 未安装或未在PATH中")
        return False

def install_python_dependencies():
    """安装Python依赖"""
    requirements_file = Path(__file__).parent / "requirements.txt"
    if not requirements_file.exists():
        print(f"❌ {requirements_file} 文件不存在")
        return False
    
    run_command(f'"{sys.executable}" -m pip install --upgrade pip', "升级pip")
    return run_command(f'"{sys.executable}" -m pip install -r {requirements_file}', "安装Python依赖")

def install_node_dependencies():
    """安装Node.js依赖"""
    package_json = Path(__file__).parent / "package.json"
    if not package_json.exists():
        print(f"❌ {package_json} 文件不存在")
        return False
    return run_command('npm install', "安装Node.js依赖")

def check_ffmpeg():
    """检查ffmpeg是否安装"""
    print("检查 ffmpeg...")
    try:
        subprocess.run(['ffmpeg', '-version'], capture_output=True, text=True, check=True)
        print("✅ ffmpeg 已安装")
        return True
    except (subprocess.CalledProcessError, FileNotFoundError):
        print("⚠️  ffmpeg 未安装")
        return False

def install_ffmpeg_instructions():
    """显示ffmpeg安装说明"""
    system = platform.system().lower()
    
    print(f"\n{'='*50}")
    print("ffmpeg 安装说明")
    print(f"{'='*50}")
    
    if system == 'darwin':  # macOS
        print("macOS 安装方法:")
        print("1. 使用 Homebrew: brew install ffmpeg")
        print("2. 或从官网下载: https://ffmpeg.org/download.html")
    elif system == 'linux':
        print("Linux 安装方法:")
        print("Ubuntu/Debian: sudo apt update && sudo apt install ffmpeg")
        print("CentOS/RHEL: sudo yum install ffmpeg")
        print("Arch: sudo pacman -S ffmpeg")
    elif system == 'windows':
        print("Windows 安装方法:")
        print("1. 从官网下载: https://ffmpeg.org/download.html")
        print("2. 解压到 C:\\ffmpeg")
        print("3. 将 C:\\ffmpeg\\bin 添加到系统PATH")
        print("4. 或使用 chocolatey: choco install ffmpeg")
    
    print(f"{'='*50}")

def create_directories():
    """创建必要的目录"""
    print("创建项目目录...")
    for dir_name in ['downloads', 'logs']:
        dir_path = Path(__file__).parent / dir_name
        dir_path.mkdir(exist_ok=True)
        print(f"✅ 目录已确认: {dir_path}")
    return True

def main():
    """主函数"""
    if not (check_python_version() and
            check_node_version() and
            create_directories() and
            install_python_dependencies() and
            install_node_dependencies()):
        print("\n❌ 环境设置失败，请检查上面的错误信息。")
        sys.exit(1)
        
    if not check_ffmpeg():
        install_ffmpeg_instructions()

    print("\n🎉 环境设置完成!")
    print("现在您可以按照 README.md 中的指示运行项目。")

if __name__ == '__main__':
    main()