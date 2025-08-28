// electron/python-manager.js

const { app, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const portfinder = require('portfinder');

// --- Global Variables ---
let pythonProcess = null; // Holds the reference to the Python child process
let apiPort = 0;          // Stores the dynamically found available port
let mainWindow = null;    // Holds the reference to the main window

/**
 * Initializes the Python Manager.
 * @param {BrowserWindow} mw - The main Electron BrowserWindow instance.
 */
function initializePythonManager(mw) {
    mainWindow = mw;
}

/**
 * [MODIFIED] Generic helper to find the path of a bundled resource.
 * Handles logic for development vs. packaged mode and cross-platform paths.
 *
 * @param {string} resourceType - The type of resource ('python', 'ffmpeg').
 * @param {object} devPaths - Paths or commands to use in development mode.
 * @returns {string|null} The absolute path to the resource or a command string.
 */
function getResourcePath(resourceType, devPaths) {
    if (app.isPackaged) {
        const platform = process.platform;
        const resourceMap = {
            python: {
                win32: ['python-win', 'python.exe'],
                darwin: ['python-mac', 'python'], // Assumes these paths
                linux: ['python-linux', 'python'],   // Assumes these paths
            },
            ffmpeg: {
                win32: ['bin', 'ffmpeg.exe'],
                darwin: ['bin', 'ffmpeg'],
                linux: ['bin', 'ffmpeg'],
            }
        };

        const platformConfig = resourceMap[resourceType]?.[platform];
        if (platformConfig) {
            const resourcePath = path.join(process.resourcesPath, ...platformConfig);
            console.log(`[Resource Manager] Using packaged ${resourceType}: ${resourcePath}`);
            return resourcePath;
        }
        console.warn(`[Resource Manager] No packaged ${resourceType} configuration found for platform: ${platform}`);
        return null;
    }

    // Development mode
    const devPath = devPaths[process.platform] || devPaths.default;
    console.log(`[Resource Manager] Using system ${resourceType}: "${devPath}"`);
    return devPath;
}

/**
 * Asynchronously starts the Python backend service.
 */
async function startPythonServer() {
    try {
        portfinder.basePort = 5000;
        apiPort = await portfinder.getPortPromise();
        console.log(`[Port Manager] Successfully found an available port: ${apiPort}`);
    } catch (err) {
        console.error('[Port Manager] Could not find an available port:', err);
        dialog.showErrorBox('Port Error', 'Could not find an available port to start the backend service.');
        app.quit();
        return;
    }

    // --- MODIFICATION: Use the new helper function ---
    const pythonExecutable = getResourcePath('python', {
        win32: 'python',
        default: 'python3' // for macOS, Linux
    });
    const ffmpegPath = getResourcePath('ffmpeg', { default: null }); // In dev, we assume it's in PATH

    if (!pythonExecutable) {
        dialog.showErrorBox('Backend Error', 'Could not locate the Python executable for this platform.');
        app.quit();
        return;
    }

    const projectRoot = path.join(__dirname, '..');
    const env = {
        ...process.env,
        PYTHONIOENCODING: 'utf-8',
        PYTHONPATH: projectRoot,
    };
    if (ffmpegPath) {
        env.FFMPEG_PATH = ffmpegPath;
    }

    const spawnArgs = ['-u', '-m', 'backend.app', '--port', apiPort];

    console.log(`[Python Manager] Starting backend service...`);
    console.log(`[Python Manager] Command: ${pythonExecutable} ${spawnArgs.join(' ')}`);

    pythonProcess = spawn(pythonExecutable, spawnArgs, {
        cwd: projectRoot,
        env: env,
    });

    pythonProcess.stdout.on('data', (data) => {
        const output = data.toString().trim();
        console.log(`[Python STDOUT]: ${output}`);
        if (output.includes('BACKEND_READY_SIGNAL') && mainWindow) {
            console.log(`[Python Manager] Backend is ready on port ${apiPort}, notifying frontend...`);
            mainWindow.webContents.send('backend-ready', apiPort);
        }
    });

    pythonProcess.stderr.on('data', (data) => {
        console.error(`[Python STDERR]: ${data.toString().trim()}`);
    });

    pythonProcess.on('close', (code) => {
        console.log(`[Python Manager] Child process exited with code: ${code}`);
        if (code !== 0 && code !== null && !app.isQuitting) {
            dialog.showErrorBox('Backend Service Error', `The Python service exited unexpectedly (code: ${code}). Please check 'logs/app.log' for details.`);
        }
        pythonProcess = null;
    });

    pythonProcess.on('error', (err) => {
        console.error('[Python Manager] Failed to start Python process:', err);
        dialog.showErrorBox('Failed to Start Backend', `Could not start the Python service: ${err.message}. \n\nPlease ensure Python is correctly installed and in PATH, or the packaged app is complete.`);
        app.quit();
    });
}

/**
 * Stops the Python backend service.
 */
function stopPythonServer() {
    if (pythonProcess) {
        console.log('[Python Manager] Stopping Python service...');
        pythonProcess.kill('SIGTERM');
        pythonProcess = null;
    }
}

module.exports = {
    initializePythonManager,
    startPythonServer,
    stopPythonServer
};