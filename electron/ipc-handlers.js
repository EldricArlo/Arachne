// electron/ipc-handlers.js

const { ipcMain, app, shell, dialog } = require('electron');
const path = require('path');

// --- 下载路径管理 ---
// 定义一个统一的、跨平台的下载路径，位于用户数据目录中，这是最佳实践
const downloadsPath = path.join(app.getPath('userData'), 'downloads');
const fs = require('fs');
// 确保下载目录存在
if (!fs.existsSync(downloadsPath)) {
    fs.mkdirSync(downloadsPath, { recursive: true });
}

/**
 * 设置所有从渲染器进程到主进程的 IPC 通信处理器。
 * @param {BrowserWindow} mainWindow - 主窗口实例，用于对话框的父窗口。
 */
function setupIpcHandlers(mainWindow) {
    
    // 处理器：打开下载文件夹
    ipcMain.handle('open-downloads-folder', () => {
        // 使用 shell.openPath 安全地打开系统文件浏览器
        shell.openPath(downloadsPath);
    });

    // 处理器：打开指定的文件路径（带有安全检查）
    ipcMain.handle('open-path', (event, filePath) => {
        const resolvedPath = path.resolve(filePath);
        // 安全性检查：确保请求打开的路径位于预期的下载目录内，防止恶意脚本访问任意文件
        if (resolvedPath.startsWith(path.resolve(downloadsPath))) {
            shell.openPath(filePath);
        } else {
            console.warn(`[IPC] 拒绝打开不安全的路径: ${filePath}`);
        }
    });

    // 处理器：显示一个原生的确认对话框
    ipcMain.handle('show-confirm-dialog', async (event, message) => {
        if (!mainWindow) return false;
        const result = await dialog.showMessageBox(mainWindow, {
            type: 'question',
            buttons: ['取消', '确定'],
            defaultId: 1, // "确定" 按钮是默认选项
            cancelId: 0,  // "取消" 按钮
            title: '请确认',
            message: message
        });
        // 如果用户点击了索引为 1 的按钮（“确定”），则返回 true
        return result.response === 1;
    });
}

/**
 * 返回应用程序的下载路径。
 * @returns {string}
 */
function getDownloadsPath() {
    return downloadsPath;
}

module.exports = { setupIpcHandlers, getDownloadsPath };
