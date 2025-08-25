// electron/ipc-handlers.js

const { ipcMain, app, shell, dialog } = require('electron');
const path = require('path');
// const { getApiPort } = require('./python-manager'); // 导入获取端口的函数

const downloadsPath = path.join(app.getPath('userData'), 'downloads');
const fs = require('fs');
if (!fs.existsSync(downloadsPath)) {
    fs.mkdirSync(downloadsPath, { recursive: true });
}

function setupIpcHandlers(mainWindow) {
    // 新增处理器：获取后端 API 的端口
    // ipcMain.handle('get-api-port', () => {
    //     return getApiPort();
    // });

    ipcMain.handle('open-downloads-folder', () => {
        shell.openPath(downloadsPath);
    });

    ipcMain.handle('open-path', (event, filePath) => {
        const resolvedPath = path.resolve(filePath);
        if (resolvedPath.startsWith(path.resolve(downloadsPath))) {
            shell.openPath(filePath);
        } else {
            console.warn(`[IPC] Denied request to open unsafe path: ${filePath}`);
        }
    });

    ipcMain.handle('show-confirm-dialog', async (event, message) => {
        if (!mainWindow) return false;
        const result = await dialog.showMessageBox(mainWindow, {
            type: 'question',
            buttons: ['取消', '确定'],
            defaultId: 1,
            cancelId: 0,
            title: '请确认',
            message: message
        });
        return result.response === 1;
    });
}

function getDownloadsPath() {
    return downloadsPath;
}

module.exports = { setupIpcHandlers, getDownloadsPath };