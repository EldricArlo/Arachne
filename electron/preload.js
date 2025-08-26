// electron/preload.js

const { contextBridge, ipcRenderer } = require('electron');

/**
 * Preload Script.
 * 
 * This script runs before the renderer process loads the page and has access to Node.js APIs.
 * Its core purpose is to act as a secure communication bridge between the main process
 * and the renderer process.
 * 
 * We use `contextBridge.exposeInMainWorld` to securely expose selected functions
 * to the renderer process's `window` object, rather than exposing the entire `ipcRenderer` module.
 * This follows Electron's Context Isolation security best practices.
 * 
 * The exposed object will be available on `window.electronAPI`.
 */
contextBridge.exposeInMainWorld('electronAPI', {
    /**
     * Waits for the backend service to be ready and gets its running port.
     * 
     * @returns {Promise<number>} A Promise that resolves with the backend's port number
     *                            once it is ready.
     */
    waitForBackend: () => new Promise(resolve => {
        // Use ipcRenderer.once to listen for the 'backend-ready' event just one time.
        // This event is sent by python-manager.js in the main process after it detects Flask has started.
        ipcRenderer.once('backend-ready', (event, port) => resolve(port));
    }),

    /**
     * Requests the main process to open a specified folder path.
     * 
     * @param {string} folderPath - The full, absolute path to the folder to be opened.
     * @returns {Promise<void>} A Promise that resolves when the main process has completed the action.
     */
    openDownloadsFolder: (folderPath) => ipcRenderer.invoke('open-downloads-folder', folderPath),

    /**
     * Requests the main process to open a specified file.
     * 
     * For security, this function requires both the file path and its containing
     * downloads directory path. The main process will validate that the file is indeed
     * within the downloads directory to prevent access to arbitrary system files.
     * 
     * @param {object} paths - An object containing path information.
     * @param {string} paths.filePath - The full path of the file to open.
     * @param {string} paths.downloadsPath - The current downloads directory path for security validation.
     * @returns {Promise<void>}
     */
    openPath: ({ filePath, downloadsPath }) => ipcRenderer.invoke('open-path', { filePath, downloadsPath }),

    /**
     * Requests the main process to show a native confirmation dialog.
     * 
     * @param {string} message - The message text to display to the user in the dialog.
     * @returns {Promise<boolean>} - The Promise resolves to true if the user clicks the confirm button, otherwise false.
     */
    showConfirmDialog: (message) => ipcRenderer.invoke('show-confirm-dialog', message),

    /**
     * Registers a callback function to listen for generic actions from the main process
     * (e.g., events triggered from the menu bar).
     * 
     * @param {function(string)} callback - The callback function to execute when an action is received.
     *                                      It receives a string argument `action`,
     *                                      representing the name of the action to perform.
     */
    onMenuAction: (callback) => ipcRenderer.on('menu-action', (event, action) => callback(action)),

    /**
     * 新增: 请求主进程打开文件夹选择对话框。
     * @returns {Promise<string|null>}
     */
    selectDownloadsFolder: () => ipcRenderer.invoke('select-downloads-folder')
});