// electron/python-manager.js

const { app, dialog, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const portfinder = require('portfinder');
const { getDownloadsPath } = require('./ipc-handlers');

let pythonProcess = null;
let apiPort = 0; // 初始化为0
let mainWindow = null; // 用于存储主窗口引用

function initializePythonManager(mw) {
    mainWindow = mw;
}

function findPythonExecutable() {
    console.log('[Python Manager] Using "python" executable for Windows compatibility.');
    return 'python';
}

function getFfmpegPath() {
    if (!app.isPackaged) {
        return null;
    }
    const platform = process.platform;
    const ffmpegExecutable = platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
    const ffmpegPath = path.join(process.resourcesPath, 'bin', ffmpegExecutable);
    console.log(`[FFmpeg Manager] Packaged FFmpeg path: ${ffmpegPath}`);
    return ffmpegPath;
}

async function startPythonServer() {
    try {
        apiPort = await portfinder.getPortPromise({ port: 8000 });
        console.log(`[Port Manager] Found available port: ${apiPort}`);
        ipcMain.handle('get-api-port', () => apiPort);
    } catch (err) {
        dialog.showErrorBox('端口错误', '无法找到可用的端口来启动后端服务。');
        return;
    }

    const pythonExecutable = findPythonExecutable();
    const ffmpegPath = getFfmpegPath();
    const env = { ...process.env };
    if (ffmpegPath) {
        env.FFMPEG_PATH = ffmpegPath;
    }
    
    // 解决中文乱码问题
    env.PYTHONIOENCODING = 'utf-8';

    console.log(`[Python Manager] Starting server script: backend.app on port ${apiPort}`);
    const projectRoot = path.join(__dirname, '..');

    pythonProcess = spawn(pythonExecutable, [
        '-u',
        '-m', 'backend.app',
        '--port', apiPort,
        '--downloads-dir', getDownloadsPath()
    ], {
        cwd: projectRoot,
        env: env
    });

    // 监听 STDOUT，当看到 Flask 成功启动的消息时，通知前端
    pythonProcess.stdout.on('data', (data) => {
        const output = data.toString().trim();
        console.log(`[Python STDOUT]: ${output}`);
        // 这是一个关键的标志，表示 Flask 服务已就绪
        if (output.includes('* Serving Flask app') && mainWindow) {
            console.log('[Python Manager] Backend is ready. Sending port to frontend.');
            mainWindow.webContents.send('backend-ready', apiPort);
        }
    });

    pythonProcess.stderr.on('data', (data) => {
        console.error(`[Python STDERR]: ${data.toString().trim()}`);
    });

    pythonProcess.on('close', (code) => {
        console.log(`[Python Manager] Process exited with code ${code}`);
        if (code !== 0 && code !== null) {
            dialog.showErrorBox('后端服务错误', `Python 服务意外退出 (代码: ${code})。请检查日志。`);
        }
        pythonProcess = null;
    });

    pythonProcess.on('error', (err) => {
        console.error('[Python Manager] Failed to start Python process:', err);
        dialog.showErrorBox('启动后端失败', `无法启动 Python 服务: ${err.message}`);
        pythonProcess = null;
    });
}

function stopPythonServer() {
    if (pythonProcess) {
        console.log('[Python Manager] Stopping Python server...');
        pythonProcess.kill('SIGTERM');
        pythonProcess = null;
    }
}

function getApiPort() {
    return apiPort;
}

module.exports = { initializePythonManager, startPythonServer, stopPythonServer, getApiPort };