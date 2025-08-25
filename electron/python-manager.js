// electron/python-manager.js

const { app, dialog, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const portfinder = require('portfinder');
const { getDownloadsPath } = require('./ipc-handlers');

let pythonProcess = null;
let apiPort = 0; // 后端 API 端口，初始化为 0
let mainWindow = null; // 主窗口引用

/**
 * 初始化 Python 管理器，并保存主窗口的引用。
 * @param {BrowserWindow} mw - Electron 的主窗口实例。
 */
function initializePythonManager(mw) {
    mainWindow = mw;
}

/**
 * 查找合适的 Python 可执行文件。
 * 在 Windows 上默认为 'python'，在其他系统上优先使用 'python3'，
 * 这样可以更好地兼容不同操作系统的环境。
 * @returns {string} 'python' 或 'python3'。
 */
function findPythonExecutable() {
    const executable = process.platform === 'win32' ? 'python' : 'python3';
    console.log(`[Python Manager] 使用 "${executable}" 作为 Python 可执行文件。`);
    return executable;
}

/**
 * 获取捆绑的 FFmpeg 路径（仅在打包应用中有效）。
 * @returns {string|null} FFmpeg 的路径，如果未打包则返回 null。
 */
function getFfmpegPath() {
    // app.isPackaged 判断当前是否为打包后的应用
    if (!app.isPackaged) {
        return null;
    }
    const platform = process.platform;
    const ffmpegExecutable = platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
    // process.resourcesPath 指向打包应用中的 resources 目录
    const ffmpegPath = path.join(process.resourcesPath, 'bin', ffmpegExecutable);
    console.log(`[FFmpeg Manager] 打包后的 FFmpeg 路径: ${ffmpegPath}`);
    return ffmpegPath;
}

/**
 * 启动 Python 后端服务。
 * 这是一个异步函数，它会先找到一个可用端口，然后启动子进程。
 */
async function startPythonServer() {
    try {
        // 使用 portfinder 自动寻找一个 8000 开始的可用端口
        apiPort = await portfinder.getPortPromise({ port: 8000 });
        console.log(`[Port Manager] 找到可用端口: ${apiPort}`);
        // 注册一个 IPC 处理器，以便前端可以随时查询端口（虽然我们主要使用一次性事件）
        ipcMain.handle('get-api-port', () => apiPort);
    } catch (err) {
        dialog.showErrorBox('端口错误', '无法找到可用的端口来启动后端服务。');
        return;
    }

    const pythonExecutable = findPythonExecutable();
    const ffmpegPath = getFfmpegPath();
    const env = { ...process.env };

    // 如果找到了捆绑的 FFmpeg，将其路径添加到子进程的环境变量中
    if (ffmpegPath) {
        env.FFMPEG_PATH = ffmpegPath;
    }
    
    // 解决在某些系统上子进程输出中文乱码的问题
    env.PYTHONIOENCODING = 'utf-8';

    console.log(`[Python Manager] 正在启动后端服务: backend.app on port ${apiPort}`);
    const projectRoot = path.join(__dirname, '..');

    // 使用 spawn 启动 Python 子进程
    pythonProcess = spawn(pythonExecutable, [
        '-u', // 无缓冲输出，确保日志可以被实时捕获
        '-m', 'backend.app', // 以模块方式运行
        '--port', apiPort,
        '--downloads-dir', getDownloadsPath()
    ], {
        cwd: projectRoot, // 设置工作目录为项目根目录
        env: env // 传入包含 FFmpeg 路径的环境变量
    });

    // --- 监听子进程的输出，这是实现前后端同步的关键 ---
    pythonProcess.stdout.on('data', (data) => {
        const output = data.toString().trim();
        console.log(`[Python STDOUT]: ${output}`);
        
        // 当我们监听到 Flask 成功启动的消息时，就通知前端
        if (output.includes('Running on') && mainWindow) {
            console.log('[Python Manager] 后端已就绪，正在发送端口到前端...');
            mainWindow.webContents.send('backend-ready', apiPort);
        }
    });

    pythonProcess.stderr.on('data', (data) => {
        console.error(`[Python STDERR]: ${data.toString().trim()}`);
    });

    pythonProcess.on('close', (code) => {
        console.log(`[Python Manager] 子进程退出，代码: ${code}`);
        if (code !== 0 && code !== null) {
            dialog.showErrorBox('后端服务错误', `Python 服务意外退出 (代码: ${code})。请检查日志。`);
        }
        pythonProcess = null;
    });

    pythonProcess.on('error', (err) => {
        console.error('[Python Manager] 启动 Python 进程失败:', err);
        dialog.showErrorBox('启动后端失败', `无法启动 Python 服务: ${err.message}. 请确保 Python 3.8+ 已安装并位于系统的 PATH 中。`);
        pythonProcess = null;
    });
}

/**
 * 停止 Python 后端服务。
 * 通常在应用退出时调用。
 */
function stopPythonServer() {
    if (pythonProcess) {
        console.log('[Python Manager] 正在停止 Python 服务...');
        // 发送 SIGTERM 信号来正常终止进程
        pythonProcess.kill('SIGTERM');
        pythonProcess = null;
    }
}

/**
 * 获取 API 端口号（主要供内部使用）。
 * @returns {number}
 */
function getApiPort() {
    return apiPort;
}

module.exports = { initializePythonManager, startPythonServer, stopPythonServer, getApiPort };
