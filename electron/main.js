// electron/main.js

const { app, BrowserWindow } = require('electron');
const path = require('path');

// --- Modular Imports ---
// Import related functionalities from local modules
const { createApplicationMenu } = require('./menu');
const { initializePythonManager, startPythonServer, stopPythonServer } = require('./python-manager');
const { setupIpcHandlers } = require('./ipc-handlers');

// Global variable that holds the reference to the main window object.
// This is necessary because if mainWindow were a local variable,
// it could be garbage-collected by JavaScript after the function finishes,
// leading to the window closing unexpectedly.
let mainWindow;

/**
 * Creates and configures the main browser window.
 */
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1000,
        height: 800,
        minWidth: 800,
        minHeight: 600,
        // Initially, do not show the window. Wait for the 'ready-to-show' event
        // to avoid a white screen flash during loading.
        show: false, 
        webPreferences: {
            // --- Key Security Settings ---
            // Enable context isolation to ensure the preload script and renderer process run in different JavaScript contexts.
            contextIsolation: true,
            // Disable Node.js integration to prevent the renderer process from directly accessing powerful Node.js APIs.
            nodeIntegration: false,
            // Specify the preload script, which will act as a secure bridge between the main and renderer processes.
            preload: path.join(__dirname, 'preload.js'),
        },
        // Set the application icon (path is relative to the project root)
        icon: path.join(__dirname, '../assets/icon.png'),
        // Hide the menu bar; users can temporarily show it by pressing the Alt key.
        autoHideMenuBar: true,
    });

    // Load the HTML file for the frontend application.
    mainWindow.loadFile(path.join(__dirname, '../frontend/index.html'));

    // --- Optimization: Provide a smoother window display experience ---
    // Only show the window when the page content is fully ready.
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
        // Automatically open DevTools only in a development environment for easy debugging.
        if (!app.isPackaged) {
            mainWindow.webContents.openDevTools();
        }
    });

    // This event is emitted when the window is closed.
    mainWindow.on('closed', () => {
        // Dereference the window object. If your application supports multi-windows,
        // you would typically store window objects in an array and remove the corresponding element here.
        mainWindow = null;
    });
}

// ===================================================================
// Application Lifecycle Event Handling
// ===================================================================

// This event is fired when Electron has finished initialization and is ready to create browser windows.
app.whenReady().then(() => {
    // 1. Create the main window
    createWindow();
    
    // 2. Initialize the Python backend manager and pass the main window instance to it
    initializePythonManager(mainWindow);
    
    // 3. Start the Python backend service
    startPythonServer();
    
    // 4. Create and set the top application menu
    createApplicationMenu();
    
    // 5. Set up all IPC communication handlers between the main and renderer processes
    setupIpcHandlers(mainWindow);

    // macOS specific: A window should be re-created when the dock icon is clicked and no other windows are open.
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

// Quit the app when all windows are closed (for Windows & Linux).
// On macOS, the app and its menu bar often stay active until the user quits explicitly with Cmd + Q.
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// --- Optimization: Ensure cleanup tasks are performed before the app quits ---
app.on('before-quit', () => {
    // Set a flag so other modules (like python-manager) know this is a normal, intentional quit.
    app.isQuitting = true;
    // Ensure the Python child process is properly terminated.
    stopPythonServer();
});