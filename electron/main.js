// electron/main.js

const { app, BrowserWindow } = require('electron');
const path = require('path');
const { createApplicationMenu } = require('./menu');
const { initializePythonManager, startPythonServer, stopPythonServer } = require('./python-manager');
const { setupIpcHandlers } = require('./ipc-handlers');

// 全局 mainWindow 变量，防止浏览器窗口对象被 JavaScript 垃圾回收机制回收
let mainWindow;

/**
 * 创建并配置主浏览器窗口。
 */
function createWindow() {
    mainWindow = new BrowserWindow({
        // 初始窗口尺寸
        width: 1000,
        height: 800,
        // 最小窗口尺寸
        minWidth: 800,
        minHeight: 600,
        // 初始不显示，等待 'ready-to-show' 事件，以避免窗口加载时的白屏现象
        show: false, 
        webPreferences: {
            // --- 安全性关键设置 ---
            // 启用上下文隔离，确保 preload 脚本和渲染器进程的逻辑在不同的 JavaScript 上下文中运行
            contextIsolation: true,
            // 禁用 Node.js 集成，防止渲染器进程直接访问 Node.js API，降低安全风险
            nodeIntegration: false,
            // 指定 preload 脚本，它是连接主进程和渲染器进程的安全桥梁
            preload: path.join(__dirname, 'preload.js'),
        },
        // 设置应用图标
        icon: path.join(__dirname, '../assets/icon.png'),
    });

    // 加载前端的 HTML 文件
    mainWindow.loadFile(path.join(__dirname, '../frontend/index.html'));

    // 监听 'ready-to-show' 事件，当页面渲染准备就绪时才显示窗口，提供更流畅的用户体验
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
        // 如果不是打包后的生产环境，则自动打开开发者工具
        if (!app.isPackaged) {
            mainWindow.webContents.openDevTools();
        }
    });

    // 监听窗口关闭事件，清空 mainWindow 引用
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// --- 应用生命周期事件处理 ---

// 当 Electron 初始化完成并准备好创建浏览器窗口时调用
app.whenReady().then(() => {
    createWindow();
    initializePythonManager(mainWindow); // 初始化 Python 管理器
    startPythonServer(); // 启动 Python 后端服务
    createApplicationMenu(); // 创建顶部应用程序菜单
    setupIpcHandlers(mainWindow); // 设置 IPC 处理器

    // 在 macOS 上，当点击 dock 图标并且没有其他窗口打开时，重新创建一个窗口
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

// 当所有窗口都关闭时退出应用 (适用于 Windows & Linux)
// 在 macOS 上，通常应用会保持在 dock 栏中
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// 在应用退出前执行清理工作
app.on('before-quit', () => {
    stopPythonServer(); // 确保 Python 子进程被正确关闭
});
