// electron/preload.js

const { contextBridge, ipcRenderer } = require('electron');

// 使用 contextBridge 在主世界 (window) 中暴露一个名为 'electronAPI' 的安全对象
contextBridge.exposeInMainWorld('electronAPI', {
    /**
     * 等待后端服务就绪。
     * 这是一个非常关键的函数，它返回一个 Promise，
     * 只有当主进程的 python-manager.js 发送 'backend-ready' 事件时，
     * 这个 Promise 才会解析 (resolve)，并返回后端服务的端口号。
     * 这使得前端可以优雅地使用 async/await 来等待后端启动。
     * @returns {Promise<number>} 一个解析为端口号的 Promise。
     */
    waitForBackend: () => new Promise(resolve => {
        // 使用 once 而不是 on，确保这个监听器只会被触发一次，避免内存泄漏
        ipcRenderer.once('backend-ready', (event, port) => resolve(port));
    }),

    /**
     * 请求主进程打开下载文件夹。
     * @returns {Promise<void>}
     */
    openDownloadsFolder: () => ipcRenderer.invoke('open-downloads-folder'),

    /**
     * 请求主进程打开指定的文件路径。
     * @param {string} filePath - 要打开的文件的完整路径。
     * @returns {Promise<void>}
     */
    openPath: (filePath) => ipcRenderer.invoke('open-path', filePath),

    /**
     * 请求主进程显示一个确认对话框。
     * @param {string} message - 对话框中显示的消息。
     * @returns {Promise<boolean>} - 如果用户点击“确定”，则返回 true。
     */
    showConfirmDialog: (message) => ipcRenderer.invoke('show-confirm-dialog', message)
});
