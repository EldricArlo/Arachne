# 🎥 Advanced Video Downloader

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Electron](https://img.shields.io/badge/Electron-28.2.2-blue?logo=electron)](https://www.electronjs.org/)
[![Python](https://img.shields.io/badge/Python-3.8+-blue?logo=python)](https://www.python.org/)
[![Flask](https://img.shields.io/badge/Flask-2.3.0-black?logo=flask)](https://flask.palletsprojects.com/)
[![yt-dlp](https://img.shields.io/badge/yt--dlp-2023.12.30-red)](https://github.com/yt-dlp/yt-dlp)

一个基于 Electron 和 Python (yt-dlp) 的现代化、跨平台视频下载器，提供强大而灵活的下载体验。

# 注意事项
1. 优化了整个代码的逻辑；
2. 重新修正了相关文件路径；
3. 处理了所有存在的表面上的报错问题；
4. 宽泛了下载器的下载地址，现在不仅仅可以下载Youtube媒体，还可以下载所有yt-dl支持的媒体；

---

![Application Screenshot](./photograph/screenshot.png)

---

## ✨ 核心功能

- **广泛的网站支持**: 得益于 `yt-dlp` 内核，支持数百个视频、音频和播放列表网站。
- **灵活的下载选项**:
    - **多种质量选择**: 从最高画质 (4K) 到最低画质，自由选择。
    - **格式转换**: 下载视频为 MP4, MKV, WebM 或提取音频为 MP3, WAV, M4A 等。
    - **仅音频模式**: 可一键切换到音频提取模式。
- **高级设置面板**:
    - 自定义下载目录。
    - 设置代理服务器以绕过网络限制。
    - 使用 `aria2c` 进行多线程加速下载。
    - 限制下载速度，以避免占用全部带宽。
- **元数据支持**: 可选择性地嵌入封面、章节和字幕信息到媒体文件中。
- **下载历史**: 方便地查看、打开或删除已下载的文件。
- **跨平台**: 支持 Windows, macOS 和 Linux。

## 🛠️ 技术栈

- **主框架**: **Electron** (负责构建桌面应用的UI和外壳)
- **前端**: HTML5, CSS3, JavaScript (无框架，原生实现)
- **后端**: **Python** + **Flask** (提供本地REST API服务)
- **核心下载引擎**: **yt-dlp** (强大的命令行下载工具)
- **打包工具**: **electron-builder** (用于将应用打包成可执行文件)

---

## 🚀 如何启动项目 (详细讲解)

请严格按照以下步骤操作，以确保项目能顺利运行。

### 1. 前提条件

在开始之前，请确保您的电脑上已安装以下软件：

- **Node.js**: **LTS 版本 (v18 或更高)**。
  - [下载地址](https://nodejs.org/)
  - 安装后，在终端中运行 `node -v` 和 `npm -v` 检查是否安装成功。
- **Python**: **3.8 或更高版本**。
  - [下载地址](https://www.python.org/)
  - **重要**: 在 Windows 上安装时，请务必勾选 **"Add Python to PATH"** 选项。
  - 在终端中运行 `python --version` 或 `python3 --version` 检查。
- **FFmpeg**: 这是合并视频和音频流的关键工具。
  - **Windows**:
    - 使用 [Chocolatey](https://chocolatey.org/): `choco install ffmpeg`
    - 使用 [Scoop](https://scoop.sh/): `scoop install ffmpeg`
  - **macOS**:
    - 使用 [Homebrew](https://brew.sh/): `brew install ffmpeg`
  - **Linux (Ubuntu/Debian)**:
    - `sudo apt update && sudo apt install ffmpeg`
  - 安装后，在终端中运行 `ffmpeg -version` 检查是否成功。

### 2. 克隆与安装

```bash
# 1. 克隆此项目到本地
git clone https://github.com/your-username/your-repo-name.git

# 2. 进入项目目录
cd your-repo-name
```

### 3. 运行自动安装脚本

项目内置了一个强大的安装脚本，它会自动完成所有环境配置。

```bash
# 运行此命令
# (在 macOS 或 Linux 上，如果默认 python 指向 Python 2，请使用 python3)
python scripts/setup.py
```

这个脚本会执行以下操作：
- 检查您的 Python 和 Node.js 版本是否符合要求。
- 创建 `downloads` 和 `logs` 文件夹。
- 使用 `pip` 安装所有 Python 依赖 (如 Flask, yt-dlp)。
- 使用 `npm` 安装所有 Node.js 依赖 (如 Electron)。

### 4. 运行应用

安装完成后，您可以通过以下两种方式运行应用：

- **开发模式 (推荐)**:
  - 实时重新加载，方便调试。
  ```bash
  npm run dev
  ```

- **生产模式**:
  - 模拟最终打包后的运行状态。
  ```bash
  npm start
  ```

---

## 📦 如何打包应用

如果您想将应用打包成可分发的可执行文件 (如 `.exe` 或 `.dmg`)，请运行以下命令：

```bash
# 为您当前的操作系统打包
npm run build

# 或者指定平台
npm run build-win    # 打包 Windows 应用
npm run build-mac    # 打包 macOS 应用
npm run build-linux  # 打包 Linux 应用
```

打包完成后，成品将位于项目根目录下的 `dist/` 文件夹中。

## 📂 项目结构

```
/
├── backend/         # Python 后端 (Flask API, 下载逻辑)
├── electron/        # Electron 主进程代码 (窗口管理, Python进程管理)
├── frontend/        # Electron 渲染器进程 (HTML, CSS, JS 界面)
├── scripts/         # 辅助脚本 (如 setup.py)
├── package.json     # Node.js 项目配置与依赖
└── requirements.txt # Python 依赖
```

## 📜 许可证


本项目采用 [MIT License](LICENSE) 授权
