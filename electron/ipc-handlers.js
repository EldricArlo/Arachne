// electron/ipc-handlers.js

const { ipcMain, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

/**
 * Sets up all IPC (Inter-Process Communication) handlers from the renderer process to the main process.
 * 
 * This function centralizes all ipcMain.handle(...) definitions for easier management.
 * It is called by main.js when the main application starts.
 * 
 * @param {BrowserWindow} mainWindow - The main window instance, primarily used as the parent for dialogs.
 */
function setupIpcHandlers(mainWindow) {

    /**
     * Handler: Opens the specified folder path.
     * 
     * This handler is asynchronous. It validates the path's existence and then opens it
     * using the system's file explorer. The path is read from the configuration by the frontend
     * and passed as an argument.
     */
    ipcMain.handle('open-downloads-folder', async (event, folderPath) => {
        // Security check: validate that the incoming folderPath is a valid string.
        if (!folderPath || typeof folderPath !== 'string') {
            console.warn(`[IPC] 'open-downloads-folder' received an invalid folder path: ${folderPath}`);
            return;
        }

        try {
            // Before opening, check if the path exists and is indeed a directory.
            const stats = await fs.promises.stat(folderPath);
            if (stats.isDirectory()) {
                // shell.openPath is the recommended and safe method provided by Electron to open local paths.
                await shell.openPath(folderPath);
            } else {
                console.warn(`[IPC] Path "${folderPath}" is not a directory.`);
                dialog.showErrorBox('Open Failed', `The specified path "${folderPath}" is not a valid directory.`);
            }
        } catch (error) {
            // fs.stat will throw an error if the path does not exist.
            console.error(`[IPC] Failed to open folder "${folderPath}":`, error);
            dialog.showErrorBox('Open Failed', `Could not open the directory "${folderPath}".\nPlease check if the download path in settings is correct, or if the directory has been deleted.`);
        }
    });

    /**
     * Handler: Opens the specified file path.
     * 
     * Core Security Feature: This handler strictly verifies that the requested file
     * is located within the known downloads directory to prevent the renderer process
     * from requesting to open arbitrary system files.
     */
    ipcMain.handle('open-path', (event, { filePath, downloadsPath }) => {
        // --- Security Validation ---
        if (!filePath || !downloadsPath) {
            console.warn(`[IPC] 'open-path' is missing filePath or downloadsPath arguments.`);
            return;
        }

        // 1. Resolve the incoming relative or non-canonical paths to absolute, canonical paths.
        //    This handles cases like '..' and './' and provides a uniform basis for comparison.
        const resolvedFilePath = path.resolve(filePath);
        const resolvedDownloadsPath = path.resolve(downloadsPath);

        // 2. Core security check: Ensure the requested file path starts with the expected downloads directory path.
        //    This is the key step to prevent path traversal attacks.
        if (resolvedFilePath.startsWith(resolvedDownloadsPath)) {
            // Validation passed, safely open the file.
            shell.openPath(resolvedFilePath);
        } else {
            console.warn(`[IPC] Denied opening of insecure path: ${filePath} (resolved to ${resolvedFilePath})`);
            // Play a system beep to indicate the operation was denied.
            shell.beep();
        }
    });

    /**
     * Handler: Displays a native confirmation dialog.
     * 
     * @param {string} message - The message to display to the user in the dialog.
     * @returns {Promise<boolean>} - Returns true if the user clicked the "OK" button.
     */
    ipcMain.handle('show-confirm-dialog', async (event, message) => {
        if (!mainWindow) return false;

        const result = await dialog.showMessageBox(mainWindow, {
            type: 'question',
            buttons: ['Cancel', 'OK'],
            defaultId: 1, // "OK" button is the default option
            cancelId: 0,  // The index of the "Cancel" button
            title: 'Please confirm',
            message: message
        });

        // dialog.showMessageBox returns an object with a 'response' property,
        // which is the index of the button the user clicked.
        return result.response === 1; // 1 is the index of the "OK" button
    });

    /**
     * 新增 Handler: 打开一个原生对话框以选择文件夹。
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
}

module.exports = { setupIpcHandlers };


// Core change: The getDownloadsPath function has been removed.
// The main process is no longer responsible for managing configuration state;
// it only executes instructions received from the renderer process.

module.exports = { setupIpcHandlers };