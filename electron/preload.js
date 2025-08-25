// electron/preload.js - CORRECTED VERSION

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // 异步调用主进程的 'get-api-port' 处理器 (保留这个作为备用或用于其他目的)
    getApiPort: () => ipcRenderer.invoke('get-api-port'),

    // 安全地监听一次 'backend-ready' 事件
    // 这个函数返回一个 Promise，当后端就绪时，它会 resolve 端口号
    waitForBackend: () => new Promise(resolve => {
        ipcRenderer.once('backend-ready', (event, port) => resolve(port));
    }),

    // 其他 API 保持不变
    openDownloadsFolder: () => ipcRenderer.invoke('open-downloads-folder'),
    openPath: (filePath) => ipcRenderer.invoke('open-path', filePath),
    showConfirmDialog: (message) => ipcRenderer.invoke('show-confirm-dialog', message)
});