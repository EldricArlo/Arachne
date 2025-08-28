// electron/preload.js

const { contextBridge, ipcRenderer } = require('electron');

/**
 * 预加载脚本。
 * 
 * 该脚本在渲染器进程加载页面之前运行，并有权访问 Node.js API。
 * 它的核心目的是作为主进程和渲染器进程之间的安全通信桥梁。
 * 
 * 我们使用 `contextBridge.exposeInMainWorld` 来安全地将选定的函数暴露给
 * 渲染器进程的 `window` 对象，而不是暴露整个 `ipcRenderer` 模块。
 * 这遵循了 Electron 的上下文隔离（Context Isolation）安全最佳实践。
 * 
 * 暴露的对象将在前端通过 `window.electronAPI` 访问。
 */
contextBridge.exposeInMainWorld('electronAPI', {
    /**
     * 等待后端服务就绪，并获取其运行端口。
     * 这是一个一次性的监听器，确保只接收一次准备就绪的信号。
     * @returns {Promise<number>} 一个 Promise，一旦后端就绪，它将解析为后端的端口号。
     */
    waitForBackend: () => new Promise(resolve => {
        // 使用 ipcRenderer.once 来只监听一次 'backend-ready' 事件。
        // 这个事件由主进程中的 python-manager.js 在检测到 Flask 启动后发送。
        ipcRenderer.once('backend-ready', (event, port) => resolve(port));
    }),

    /**
     * 请求主进程打开一个指定的文件夹路径。
     * 
     * @param {string} folderPath - 要打开的文件夹的完整、绝对路径。
     * @returns {Promise<void>} 一个 Promise，在主进程完成操作后解析。
     */
    openDownloadsFolder: (folderPath) => ipcRenderer.invoke('open-downloads-folder', folderPath),

    /**
     * 请求主进程打开一个指定的文件。
     * 
     * 出于安全考虑，此函数需要文件路径及其所在的下载目录路径。
     * 主进程将验证该文件确实位于下载目录中，以防止访问任意系统文件。
     * 
     * @param {object} paths - 包含路径信息的对象。
     * @param {string} paths.filePath - 要打开的文件的完整路径。
     * @param {string} paths.downloadsPath - 当前的下载目录路径，用于安全验证。
     * @returns {Promise<void>}
     */
    openPath: ({ filePath, downloadsPath }) => ipcRenderer.invoke('open-path', { filePath, downloadsPath }),

    /**
     * 请求主进程显示一个原生的确认对话框。
     * 
     * @param {string} message - 在对话框中向用户显示的文本。
     * @returns {Promise<boolean>} - 如果用户点击确认按钮，Promise 解析为 true，否则为 false。
     */
    showConfirmDialog: (message) => ipcRenderer.invoke('show-confirm-dialog', message),

    /**
     * 请求主进程打开一个文件夹选择对话框。
     * 
     * @returns {Promise<string|null>} - Promise 解析为用户选择的文件夹路径，如果取消则为 null。
     */
    selectDownloadsFolder: () => ipcRenderer.invoke('select-downloads-folder'),

    /**
     * 【新增】请求主进程打开图片选择对话框，并返回图片的 Data URI。
     * 
     * @returns {Promise<string|null>} - Promise 解析为图片的 Data URI 字符串，如果取消则为 null。
     */
    selectProfileImage: () => ipcRenderer.invoke('select-profile-image'),

    /**
     * 注册一个回调函数，以监听来自主进程的通用操作（例如，由菜单栏触发的事件）。
     * 
     * @param {function(string)} callback - 当接收到操作时执行的回调函数。
     *                                      它接收一个字符串参数 `action`，
     *                                      代表要执行的操作名称。
     */
    onMenuAction: (callback) => ipcRenderer.on('menu-action', (event, action) => callback(action)),
});