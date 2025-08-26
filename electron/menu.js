// electron/menu.js

const { Menu, BrowserWindow } = require('electron');
// --- Core change: No longer need to import anything from ipc-handlers ---

/**
 * Creates and sets the application's top menu bar.
 */
function createApplicationMenu() {
    // Define the menu template, which is an array describing the menu structure.
    const template = [
        // --- File Menu ---
        {
            label: 'File',
            submenu: [
                {
                    label: 'Open Downloads Folder',
                    accelerator: 'CmdOrCtrl+O', // Set a cross-platform accelerator (shortcut)
                    click: () => {
                        // --- Core change: Instead of direct action, send a message to the renderer process ---
                        // 1. Get the currently focused window
                        const focusedWindow = BrowserWindow.getFocusedWindow();
                        // 2. If an active window exists, send a 'menu-action' event to it
                        if (focusedWindow) {
                            // 'open-downloads-folder' is the action name we've defined.
                            // The main.js in the frontend will listen for this event and execute the corresponding action.
                            focusedWindow.webContents.send('menu-action', 'open-downloads-folder');
                        }
                    }
                },
                { type: 'separator' }, // A separator line
                {
                    label: 'Exit',
                    role: 'quit' // Use the built-in 'quit' role, Electron handles the exit logic automatically
                }
            ]
        },
        // --- Edit Menu (Standardized) ---
        {
            label: 'Edit',
            // Using built-in roles automatically provides standard editing functions and shortcuts (Cut, Copy, Paste)
            submenu: [
                { label: 'Undo', role: 'undo' },
                { label: 'Redo', role: 'redo' },
                { type: 'separator' },
                { label: 'Cut', role: 'cut' },
                { label: 'Copy', role: 'copy' },
                { label: 'Paste', role: 'paste' }
            ]
        },
        // --- View Menu (for development and debugging convenience) ---
        {
            label: 'View',
            submenu: [
                { label: 'Reload', role: 'reload' },
                { label: 'Force Reload', role: 'forceReload' },
                { label: 'Toggle Developer Tools', role: 'toggleDevTools' },
                { type: 'separator' },
                { label: 'Actual Size', role: 'resetZoom' },
                { label: 'Zoom In', role: 'zoomIn' },
                { label: 'Zoom Out', role: 'zoomOut' },
                { type: 'separator' },
                { label: 'Toggle Full Screen', role: 'togglefullscreen' }
            ]
        }
    ];

    // Build the menu from the template
    const menu = Menu.buildFromTemplate(template);
    // Set the built menu as the application's menu
    Menu.setApplicationMenu(menu);
}

module.exports = { createApplicationMenu };