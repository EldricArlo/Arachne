// electron/ipc-handlers.js

const { ipcMain, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

/**
 * 设置所有从渲染器进程到主进程的 IPC (Inter-Process Communication) 处理器。
 * 
 * 这个函数集中了所有的 ipcMain.handle(...) 定义，便于管理。
 * 它在 main.js 中应用启动时被调用。
 * 
 * @param {BrowserWindow} mainWindow - 主窗口实例，主要用作对话框的父窗口。
 */
function setupIpcHandlers(mainWindow) {

    /**
     * 处理器: 打开指定的文件夹路径。
     * 
     * 这个处理器是异步的。它会验证路径是否存在，然后使用系统的文件浏览器打开它。
     * 路径由前端从配置中读取后作为参数传入。
     */
    ipcMain.handle('open-downloads-folder', async (event, folderPath) => {
        // 安全检查：验证传入的 folderPath 是一个有效的字符串。
        if (!folderPath || typeof folderPath !== 'string') {
            console.warn(`[IPC] 'open-downloads-folder' received an invalid folder path: ${folderPath}`);
            return;
        }

        try {
            // 在打开前，检查路径是否存在且确实是一个目录。
            const stats = await fs.promises.stat(folderPath);
            if (stats.isDirectory()) {
                // shell.openPath 是 Electron 推荐的安全方法，用于打开本地路径。
                await shell.openPath(folderPath);
            } else {
                console.warn(`[IPC] Path "${folderPath}" is not a directory.`);
                dialog.showErrorBox('Open Failed', `The specified path "${folderPath}" is not a valid directory.`);
            }
        } catch (error) {
            // 如果路径不存在，fs.stat 会抛出错误。
            console.error(`[IPC] Failed to open folder "${folderPath}":`, error);
            dialog.showErrorBox('Open Failed', `Could not open the directory "${folderPath}".\nPlease check if the download path in settings is correct, or if the directory has been deleted.`);
        }
    });

    /**
     * 处理器: 打开指定的文件路径。
     * 
     * 核心安全特性: 此处理器严格验证所请求的文件是否位于已知的下载目录内，
     * 以防止渲染器进程请求打开任意系统文件（路径遍历攻击）。
     */
    ipcMain.handle('open-path', (event, { filePath, downloadsPath }) => {
        // --- 安全性验证 ---
        if (!filePath || !downloadsPath) {
            console.warn(`[IPC] 'open-path' is missing filePath or downloadsPath arguments.`);
            return;
        }

        // 1. 将传入的相对路径或非规范路径解析为绝对、规范的路径。
        //    这能处理 '..' 和 './' 等情况，为比较提供统一的基础。
        const resolvedFilePath = path.resolve(filePath);
        const resolvedDownloadsPath = path.resolve(downloadsPath);

        // 2. 核心安全检查：确保请求的文件路径以预期的下载目录路径开头。
        if (resolvedFilePath.startsWith(resolvedDownloadsPath)) {
            // 验证通过，安全地打开文件。
            shell.openPath(resolvedFilePath);
        } else {
            console.warn(`[IPC] Denied opening of insecure path: ${filePath} (resolved to ${resolvedFilePath})`);
            // 播放系统提示音，表示操作被拒绝。
            shell.beep();
        }
    });

    /**
     * 处理器: 显示一个原生的确认对话框。
     * 
     * @param {string} message - 在对话框中向用户显示的消息。
     * @returns {Promise<boolean>} - 如果用户点击了 "OK" 按钮，则返回 true。
     */
    ipcMain.handle('show-confirm-dialog', async (event, message) => {
        if (!mainWindow) return false;

        const result = await dialog.showMessageBox(mainWindow, {
            type: 'question',
            buttons: ['Cancel', 'OK'],
            defaultId: 1, // "OK" 按钮是默认选项
            cancelId: 0,  // "Cancel" 按钮的索引
            title: 'Please confirm',
            message: message
        });

        // dialog.showMessageBox 返回一个带有 'response' 属性的对象，
        // 该属性是用户点击的按钮的索引。
        return result.response === 1; // 1 是 "OK" 按钮的索引
    });

    /**
     * 处理器: 打开一个原生对话框以选择文件夹。
     * 
     * @returns {Promise<string|null>} - 返回用户选择的文件夹的绝对路径，如果用户取消则返回 null。
     */
    ipcMain.handle('select-downloads-folder', async () => {
        if (!mainWindow) return null;

        const result = await dialog.showOpenDialog(mainWindow, {
            properties: ['openDirectory'] // 关键：指定为文件夹选择模式
        });

        // 如果用户没有取消并且选择了一个路径
        if (!result.canceled && result.filePaths.length > 0) {
            return result.filePaths[0]; // 返回选择的第一个文件夹路径
        }

        return null; // 用户取消了选择
    });
    
    /**
     * 【新增】处理器: 打开一个原生对话框以选择图片文件, 并将其转换为 Data URI。
     * 这是实现本地头像上传功能的核心。前端无法直接读取本地文件，必须通过主进程来完成。
     * 
     * @returns {Promise<string|null>} - 返回图片的 Data URI 字符串，如果用户取消或读取失败则返回 null。
     */
    ipcMain.handle('select-profile-image', async () => {
        if (!mainWindow) return null;

        // 1. 打开文件选择对话框，并限制只能选择图片文件。
        const result = await dialog.showOpenDialog(mainWindow, {
            title: 'Select Avatar Image',
            properties: ['openFile'],
            filters: [
                { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp'] }
            ]
        });

        // 2. 检查用户是否已成功选择文件。
        if (!result.canceled && result.filePaths.length > 0) {
            const filePath = result.filePaths[0];
            try {
                // 3. 使用 Node.js 的 'fs' 模块异步读取文件内容到一个 Buffer 中。
                const fileBuffer = await fs.promises.readFile(filePath);
                
                // 4. 将文件 Buffer 编码为 Base64 字符串。
                const base64String = fileBuffer.toString('base64');
                
                // 5. 根据文件扩展名确定 MIME 类型 (例如 'image/png')。
                const mimeType = `image/${path.extname(filePath).substring(1)}`;
                
                // 6. 构建并返回标准的 Data URI 格式，前端可以直接将其用于 <img> 的 src 属性。
                return `data:${mimeType};base64,${base64String}`;

            } catch (error) {
                console.error(`[IPC] Failed to read or convert image file:`, error);
                dialog.showErrorBox('File Error', 'Could not read the selected image file.');
                return null;
            }
        }

        return null; // 用户取消了对话框
    });
}

module.exports = { setupIpcHandlers };