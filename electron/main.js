// electron/main.js

const { app, BrowserWindow } = require('electron');
const path = require('path');
const { createApplicationMenu } = require('./menu');
const { initializePythonManager, startPythonServer, stopPythonServer } = require('./python-manager');
const { setupIpcHandlers } = require('./ipc-handlers');

// 全局变量，防止垃圾回收
let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1000,
        height: 800,
        minWidth: 800,
        minHeight: 600,
        show: false, // 等待 ready-to-show 事件以避免白屏
        webPreferences: {
            // 安全设置：启用上下文隔离并指定预加载脚本
            contextIsolation: true,
            nodeIntegration: false,
            preload: path.join(__dirname, 'preload.js'),
        },
        icon: path.join(__dirname, '../assets/icon.png'), // 路径修正
    });

    // 加载前端页面
    mainWindow.loadFile(path.join(__dirname, '../frontend/index.html'));

    // 优雅地显示窗口
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
        // 开发模式下自动打开开发者工具
        if (!app.isPackaged) {
            mainWindow.webContents.openDevTools();
        }
    });

    // 窗口关闭时清空引用
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// --- 应用生命周期事件 ---

// Electron 初始化完成
app.whenReady().then(() => {
    createWindow();
    initializePythonManager(mainWindow);
    startPythonServer();
    createApplicationMenu();
    setupIpcHandlers(mainWindow);

    // macOS dock 图标点击事件
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

// 所有窗口关闭时退出应用 (Windows & Linux)
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// 应用退出前执行清理
app.on('before-quit', () => {
    stopPythonServer();
});
