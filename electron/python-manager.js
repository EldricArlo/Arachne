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
 * 
 * This function is called on main application startup to save a reference
 * to the main window, so that messages about backend readiness can be sent to it later.
 * 
 * @param {BrowserWindow} mw - The main Electron BrowserWindow instance.
 */
function initializePythonManager(mw) {
    mainWindow = mw;
}

/**
 * Intelligently finds the appropriate Python executable.
 * 
 * Considers the differences between operating systems. Windows typically uses 'python',
 * while macOS and Linux often use 'python3'.
 * 
 * @returns {string} 'python' or 'python3'.
 */
function findPythonExecutable() {
    const executable = process.platform === 'win32' ? 'python' : 'python3';
    console.log(`[Python Manager] Using "${executable}" as the Python executable.`);
    return executable;
}

/**
 * Gets the path to the bundled FFmpeg (only effective after the app is packaged).
 * 
 * In a development environment, we assume FFmpeg is in the system PATH.
 * In a production environment (after packaging), we look for it in the app's resources directory.
 * 
 * @returns {string|null} The absolute path to FFmpeg, or null if not packaged or not found.
 */
function getFfmpegPath() {
    if (!app.isPackaged) {
        return null;
    }
    const platform = process.platform;
    const ffmpegExecutable = platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
    // process.resourcesPath points to the directory containing the app.asar file after packaging
    const ffmpegPath = path.join(process.resourcesPath, 'bin', ffmpegExecutable);
    console.log(`[FFmpeg Manager] Packaged FFmpeg path: ${ffmpegPath}`);
    return ffmpegPath;
}

/**
 * Asynchronously starts the Python backend service.
 * 
 * This is the core function of the manager. It is responsible for:
 * 1. Finding an unused port.
 * 2. Preparing the environment variables and arguments needed to start the Python child process.
 * 3. Spawning the child process.
 * 4. Listening to the child process's output to determine when the service is ready.
 * 5. Handling various potential error scenarios.
 */
async function startPythonServer() {
    // 1. Dynamically find an available port
    try {
        portfinder.basePort = 5000; // Start searching from port 5000
        apiPort = await portfinder.getPortPromise();
        console.log(`[Port Manager] Successfully found an available port: ${apiPort}`);
    } catch (err) {
        console.error('[Port Manager] Could not find an available port:', err);
        dialog.showErrorBox('Port Error', 'Could not find an available port to start the backend service.');
        app.quit();
        return;
    }

    const pythonExecutable = findPythonExecutable();
    const ffmpegPath = getFfmpegPath();
    const projectRoot = path.join(__dirname, '..'); // Project root directory

    // 2. Prepare environment variables
    const env = {
        ...process.env,
        PYTHONIOENCODING: 'utf-8', // Force UTF-8 encoding to prevent garbled logs
        PYTHONPATH: projectRoot,
    };

    if (ffmpegPath) {
        env.FFMPEG_PATH = ffmpegPath; // Inform the backend of the packaged ffmpeg path
    }

    // 3. Prepare spawn arguments
    const spawnArgs = [
        '-u',                 // Unbuffered I/O to ensure real-time log output
        '-m', 'backend.app',  // Run backend/app.py as a module
        '--port', apiPort,    // Core: Pass the dynamically found port to the backend
    ];

    console.log(`[Python Manager] Starting backend service...`);
    console.log(`[Python Manager] Command: ${pythonExecutable} ${spawnArgs.join(' ')}`);

    // 4. Spawn the child process
    pythonProcess = spawn(pythonExecutable, spawnArgs, {
        cwd: projectRoot, // Set working directory to project root, crucial for file I/O
        env: env,
    });

    // 5. Listen to the child process's output and events
    pythonProcess.stdout.on('data', (data) => {
        const output = data.toString().trim();
        console.log(`[Python STDOUT]: ${output}`);

        // --- MODIFICATION START ---
        // Listen for our custom, reliable signal instead of the default Flask startup message.
        // This makes the startup detection much more robust.
        // The signal 'BACKEND_READY_SIGNAL' will be printed by app.py upon successful startup.
        if (output.includes('BACKEND_READY_SIGNAL') && mainWindow) {
            console.log(`[Python Manager] Backend is ready on port ${apiPort}, notifying frontend...`);
            // Backend is ready, send 'backend-ready' event and port number to the renderer process
            mainWindow.webContents.send('backend-ready', apiPort);
        }
        // --- MODIFICATION END ---
    });

    pythonProcess.stderr.on('data', (data) => {
        // Print errors directly for easy debugging
        console.error(`[Python STDERR]: ${data.toString().trim()}`);
    });

    pythonProcess.on('close', (code) => {
        console.log(`[Python Manager] Child process exited with code: ${code}`);
        // If the app is not quitting but the backend closed, it usually indicates an error.
        if (code !== 0 && code !== null && !app.isQuitting) {
            dialog.showErrorBox('Backend Service Error', `The Python service exited unexpectedly (code: ${code}). Please check the log file 'logs/app.log' for details.`);
        }
        pythonProcess = null;
    });

    pythonProcess.on('error', (err) => {
        console.error('[Python Manager] Failed to start Python process:', err);
        dialog.showErrorBox('Failed to Start Backend', `Could not start the Python service: ${err.message}. \n\nPlease ensure Python 3.8+ is correctly installed and added to the system's PATH environment variable.`);
        app.quit();
    });
}

/**
 * Stops the Python backend service.
 * 
 * Called when the application quits to ensure the Python child process is cleanly shut down.
 */
function stopPythonServer() {
    if (pythonProcess) {
        console.log('[Python Manager] Stopping Python service...');
        // Use the SIGTERM signal to attempt a graceful termination of the process
        pythonProcess.kill('SIGTERM');
        pythonProcess = null;
    }
}

module.exports = {
    initializePythonManager,
    startPythonServer,
    stopPythonServer
};