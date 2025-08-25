# Arachne
A downloader based on yt-dlp.

# YouTube 高级视频下载器

这是一个基于 Python (Flask, yt-dlp) 后端和 Electron 前端构建的桌面视频下载工具，旨在提供一个功能强大且用户友好的视频下载体验。


## ✨ 功能特性

-   **视频下载**: 支持多种视频质量选择 (4K, 1080p, 720p 等)。
-   **格式转换**: 可将视频下载为 `MP4`, `WebM`, `MKV` 等格式。
-   **纯音频提取**: 可直接将视频下载为 `MP3`, `WAV` 等纯音频格式。
-   **附加内容**: 支持下载视频的字幕和封面缩略图。
-   **播放列表**: 支持一次性下载整个 YouTube 播放列表。
-   **并发下载**: 支持最多 3 个任务同时进行，有效利用带宽。
-   **历史记录**: 自动记录已下载的文件，方便管理、打开和删除。
-   **跨平台**: 基于 Electron 构建，理论上支持 Windows, macOS 和 Linux。

## 🛠️ 技术栈

-   **后端**: Python 3.8+, Flask, yt-dlp
-   **前端**: HTML, CSS, JavaScript (原生)
-   **桌面应用框架**: Electron
-   **核心依赖**: FFmpeg (用于所有视频/音频的合并与格式转换)

---

## 🚀 环境准备 (Prerequisites)

在开始之前，你必须在你的电脑上安装并配置好以下三个核心组件。**请严格按照步骤操作，尤其是环境变量的配置，这将避免 90% 的启动问题。**

### 1. Node.js 和 npm

这是运行 Electron 和前端项目的必需环境。

-   **下载地址**: [https://nodejs.org/](https://nodejs.org/)
-   **推荐版本**: 请下载 **LTS (长期支持)** 版本。
-   **安装方法**:
    1.  运行下载的安装程序。
    2.  在安装过程中，保持所有默认选项勾选即可。`npm` (Node 包管理器) 会被自动一同安装。
    3.  安装完成后，打开一个新的终端 (CMD 或 PowerShell) 并运行以下命令来验证安装：
        ```bash
        node -v
        # 应该会显示一个版本号，如 v18.17.0
        npm -v
        # 应该会显示一个版本号，如 9.6.7
        ```

### 2. Python

这是运行后端服务的必需环境。

-   **下载地址**: [https://www.python.org/downloads/](https://www.python.org/downloads/)
-   **要求版本**: **Python 3.8** 或更高版本。
-   **安装方法 (Windows - 极其重要！)**:
    1.  运行下载的安装程序。
    2.  在安装的第一个界面，**务必、务必、务必勾选 `Add Python to PATH`** 这个选项！
        ![勾选 Add to PATH](https://docs.python.org/3/_images/win_installer.png) <!-- 图片引用自 Python 官方文档 -->
    3.  勾选后，点击 "Install Now" 继续安装。
    4.  安装完成后，打开一个新的终端并运行以下命令验证：
        ```bash
        python --version
        # 应该会显示一个版本号，如 Python 3.10.4
        ```

### 3. FFmpeg

这是 `yt-dlp` 用来合并视频和音频流、以及进行格式转换的核心工具。**没有它，你将无法下载任何高清视频或进行格式转换。**

-   **下载地址**: [https://www.ffmpeg.org/download.html](https://www.ffmpeg.org/download.html)
-   **安装方法 (Windows - 请仔细操作)**:
    1.  在下载页面，将鼠标悬停在 Windows 图标上，然后点击推荐的 gyan.dev 或 BtbN 链接。
    2.  在 `gyan.dev` 网站上，找到 `release` 版本，下载名为 `ffmpeg-release-full.7z` 的压缩包。
    3.  下载后，使用解压软件 (如 7-Zip 或 Bandizip) 将其解压。
    4.  将解压后的整个文件夹重命名为 `ffmpeg`，并将其移动到一个简单、无中文、无空格的路径下，例如 `C:\ffmpeg`。
    5.  **配置环境变量 (关键步骤)**:
        a. 在 Windows 搜索中搜索 “**编辑系统环境变量**” 并打开它。
        b. 在弹出的窗口中，点击 “**环境变量...**” 按钮。
        c. 在下方的 “**系统变量**” 区域，找到名为 `Path` 的变量，双击它。
        d. 在弹出的列表中，点击 “**新建**”，然后输入你刚刚存放 FFmpeg 的 `bin` 目录的完整路径，即 `C:\ffmpeg\bin`。
        e. 一路点击“确定”保存所有窗口。
    6.  **验证安装**: **完全关闭并重新打开**一个新的终端，输入以下命令：
        ```bash
        ffmpeg -version
        # 如果显示一大串版本和库信息，而不是“命令未找到”，则说明配置成功。
        ```
    7.  有可能FFmpeg.exe的存在路径一定要是在和README.md文件同级的bin文件夹下

---

## ⚙️ 安装与配置

当你完成了上述所有环境准备后，就可以开始安装项目了。

1.  **克隆代码库**:
    ```bash
    git clone https://github.com/eldric/Arachne.git
    cd Arachne
    ```
    (如果你是直接下载的 ZIP 包，请解压并进入项目根目录)

2.  **运行一键安装脚本**:
    项目提供了一个 `setup.py` 脚本，可以自动帮你安装所有 Python 和 Node.js 的依赖。
    ```bash
    python setup.py
    ```
    这个脚本会：
    -   检查你的 Python 和 Node.js 版本。
    -   创建必要的 `logs` 和 `downloads` 目录。
    -   安装 `requirements.txt` 中所有的 Python 包 (如 Flask, yt-dlp)。
    -   运行 `npm install` 来安装 `package.json` 中所有的 Node.js 包 (如 Electron)。

---

## 💻 启动程序 (开发模式)

在开发模式下，你需要同时运行后端服务和前端应用。这需要**打开两个独立的终端**。

#### 终端 1: 启动 Python 后端服务

```bash
# 进入项目根目录
cd path/to/your-project

# 激活 Python 虚拟环境 (推荐)
# 如果 setup.py 帮你创建了 .venv
.\.venv\Scripts\Activate.ps1

# 以模块方式运行后端应用
python -m backend.app
```
当你看到类似下面的输出时，表示后端已成功启动：
`* Serving Flask app 'app'`
`* Running on http://127.0.0.1:xxxx` (端口号可能是动态的)

**请保持这个终端窗口不要关闭。**

#### 终端 2: 启动 Electron 前端应用

```bash
# 同样进入项目根目录
cd path/to/your-project

# 运行启动命令
npm start```
稍等片刻，Electron 应用程序的窗口就会弹出。

---

## 📦 打包为可执行文件

当你完成了开发，想要创建一个可以分发给其他 Windows 用户的 `.exe` 安装包时，可以运行以下命令：

```bash
# 确保你在项目根目录下
npm run build
```
这个过程会需要几分钟。完成后，你会在项目根目录下的 `dist/` 文件夹中找到生成的 `.exe` 安装文件。

---

## ⚠️ 常见问题与解决方案 (Troubleshooting)

在启动或使用过程中，你可能会遇到一些问题。这里列出了最常见的问题及其解决方案。

#### 1. 错误: `'electron' 不是内部或外部命令...`

-   **原因**: 项目的 Node.js 依赖没有安装。
-   **解决方案**: 在项目根目录下运行 `npm install`。

#### 2. 错误: `npm install` 失败，并显示 `ECONNRESET` 或 `timeout`

-   **原因**: 网络问题，通常是因为 npm 官方源在国内访问不稳定。
-   **解决方案**: 切换到国内的淘宝镜像源，然后重新安装。
    ```bash
    # 设置 npm 镜像
    npm config set registry https://registry.npmmirror.com
    
    # 单独为 Electron 设置镜像 (非常重要！)
    npm config set ELECTRON_MIRROR "https://npmmirror.com/mirrors/electron/"

    # 清理缓存并重新安装
    npm cache clean --force
    npm install
    ```

#### 3. 弹窗错误: “无法找到可用的端口启动后端服务”

-   **原因**: `5000` 或 `8000` 附近的端口被其他程序占用了。最常见的是上次异常关闭后残留的 "僵尸" Python 进程。
-   **解决方案**:
    1.  以**管理员身份**打开 PowerShell 或 CMD。
    2.  运行命令强制关闭所有 Python 进程：`taskkill /F /IM python.exe`。
    3.  如果问题依旧，说明是其他程序占用了端口。可以修改 `electron/python-manager.js` 文件中 `portfinder.getPortPromise({ port: 8000 })` 的端口号为一个更不常用的值，比如 `13370`。

#### 4. 弹窗错误: “Python 服务意外退出 (代码: 9009)”

-   **原因**: **退出码 9009** 意味着 “命令未找到”。Electron 尝试运行 `python` 命令，但在系统的 `PATH` 环境变量中找不到它。
-   **解决方案**: 你在安装 Python 时忘记了勾选 `Add Python to PATH`。请重新安装 Python，并**务必勾选**该选项。

#### 5. 弹窗错误: “Python 服务意外退出 (代码: 1)” 并看到 `ModuleNotFoundError: No module named 'backend'`

-   **原因**: Python 解释器的工作目录不正确，导致它无法找到项目模块。
-   **解决方案**: 确保你是用 `python -m backend.app` 的方式启动后端，而不是 `python backend/app.py`。本项目代码已经修复了此问题，但如果你自行修改了 `electron/python-manager.js`，请留意这一点。

#### 6. 点击“开始下载”按钮毫无反应

-   **原因**: 通常是输入验证失败。
    1.  你没有输入任何 URL。
    2.  你输入的不是一个**有效且格式正确**的 YouTube 链接。
    3.  你复制的分享链接可能带有时间戳等额外参数 (`?t=...`)，前端的验证逻辑可能无法识别。请尝试使用视频最原始、最干净的 URL。
-   **解决方案**: 按 `Ctrl + Shift + I` 打开开发者工具，查看 `Console` (控制台) 中的具体错误信息。

---

## 📂 项目结构

```
.
├── backend/          # Python 后端 Flask 代码
│   ├── api_routes.py   # API 路由
│   ├── app.py          # Flask 应用入口
│   ├── config.py       # 配置文件
│   ├── downloader.py   # yt-dlp 核心下载逻辑
│   └── ...
├── electron/         # Electron 主进程代码
│   ├── main.js         # Electron 主入口
│   ├── preload.js      # 预加载脚本，用于主进程和渲染进程的安全通信
│   ├── python-manager.js # 管理 Python 子进程
│   └── ...
├── frontend/         # 前端 UI 界面代码
│   ├── css/
│   ├── js/
│   └── index.html
├── node_modules/     # Node.js 依赖
├── .venv/            # Python 虚拟环境
├── package.json      # Node.js 项目配置和依赖
└── requirements.txt  # Python 项目依赖
```

# 注意事项

这个是第一个版本，所以还存在很多的错误没有解决
1. 只能下载youtube中的视频（当然，这主要是防止下载了不安全链接而设置的，但明显不好用）；
2. 点击下载之后，即使是显示下载完成，也没办法找到下载的文件在什么路径（我反正找不到在哪里，可能那个下载完成就是一个心理安慰吧）；
3. console还是存在一个警告没有解决；
4. UI界面设计的像是60岁老大妈的花衬衫一样难看，我正在试图制作一个更为漂亮的UI界面，虽然这可能有点难度；
5. UI在打开之后会主动进入开发者模式，应该是进入正常的用户模式，只有需要进入开发者模式的情况下才能进入，否则一律处于用户模式下；
6. 日志设计得还是有一些不合理，需要一个更加全面附有逻辑的日志报告；
7. 下载历史记录无法显示内容；
8. FFmpeg组件需要用户自己去下载
