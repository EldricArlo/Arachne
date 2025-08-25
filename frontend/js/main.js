// frontend/js/main.js

/**
 * Main Application Class (App).
 * 
 * Responsible for core business logic and application state management. It acts as the
 * coordinator between the UI (ui.js) and the API (api.js).
 * 
 * - It does not directly manipulate the DOM.
 * - It does not directly initiate fetch requests.
 * - It calls API methods to get or send data.
 * - It calls UI methods to respond to user actions and update the interface.
 */
class App {
    constructor() {
        this.progressInterval = null; // Timer ID for polling download progress
        this.config = null;           // Stores the application configuration loaded from the backend
    }

    /**
     * Asynchronously initializes the application.
     * This is the entry point for starting the app.
     */
    async init() {
        // Crucial: Wait for the API module to complete its initialization with the backend.
        // Any API calls will be blocked until this is done.
        await api.initializationPromise;

        // Set up event listeners from the main process (e.g., menu bar)
        this.setupMenuListener();

        // Execute tasks required for application startup in sequence
        ui.addLog('Application starting');
        await this.checkBackendStatus();
        await this.loadConfig();
        await ui.loadDownloadHistory();
        ui.addLog('Initialization complete, application is ready.');
    }

    /**
     * Sets up a listener to receive menu actions from the main process.
     */
    setupMenuListener() {
        window.electronAPI.onMenuAction((action) => {
            ui.addLog(`Received action from menu: ${action}`);
            switch (action) {
                case 'open-downloads-folder':
                    this.openDownloadsFolder();
                    break;
                // Other menu functions can be easily extended here
            }
        });
    }

    /**
     * Checks the connection status of the backend service and provides feedback on the UI.
     */
    async checkBackendStatus() {
        try {
            const isOnline = await api.checkStatus();
            if (isOnline) {
                ui.addLog('Backend service connected successfully', 'success');
                ui.showNotification('Service is ready', 'success');
            } else {
                throw new Error('Backend service did not respond');
            }
        } catch (error) {
            ui.addLog(`Backend service connection failed: ${error.message}`, 'error');
            ui.showNotification('Could not connect to backend service, please restart the application', 'error', 5000);
        }
    }

    /**
     * Loads the application configuration from the backend and stores it in the App instance.
     */
    async loadConfig() {
        try {
            ui.addLog('Loading application configuration...');
            const response = await api.getConfig();
            if (response.success) {
                this.config = response.config; // Save the config in the instance
                ui.addLog('Application configuration loaded successfully');
                console.log('Current configuration:', this.config);
            } else {
                throw new Error(response.error || 'Failed to get configuration');
            }
        } catch (error) {
            ui.addLog(`Failed to load configuration: ${error.message}`, 'error');
            ui.showNotification('Failed to load configuration, will use default values', 'error');
        }
    }

    /**
     * Saves the new configuration to the backend.
     * @param {object} newConfig - The new configuration object.
     */
    async saveConfig(newConfig) {
        try {
            ui.addLog('Saving configuration...');
            const response = await api.updateConfig(newConfig);
            if (response.success) {
                ui.addLog('Configuration saved successfully', 'success');
                ui.showNotification('Settings have been saved', 'success');
                await this.loadConfig(); // Reload after saving to sync state
            } else {
                throw new Error(response.error || 'Failed to save configuration');
            }
        } catch (error) {
            ui.addLog(`Failed to save configuration: ${error.message}`, 'error');
            ui.showNotification(`Failed to save settings: ${error.message}`, 'error');
        }
    }
    
    /**
     * Business logic for opening the downloads folder.
     * It directly calls a UI layer method to trigger the main process action.
     */
    openDownloadsFolder() {
        // The App class decides when to call, the UI class implements how
        ui.openDownloadsFolder();
    }

    /**
     * Business logic for deleting a specific file, including a user confirmation step.
     * @param {string} filename - The name of the file to delete.
     */
    async deleteFile(filename) {
        if (!filename) return;
        try {
            // Business logic: prompt the user for confirmation before deleting.
            const confirmed = await window.electronAPI.showConfirmDialog(
                `Are you sure you want to delete the file "${filename}"?\nThis action cannot be undone.`
            );
            
            if (confirmed) {
                ui.addLog(`User confirmed deletion of file: ${filename}`);
                await api.deleteFile(filename); // Call the API
                ui.showNotification(`File "${filename}" has been deleted`, 'success');
                await ui.loadDownloadHistory(); // Update the UI
            } else {
                ui.addLog(`User canceled the delete operation for: ${filename}`);
            }
        } catch (error) {
            ui.addLog(`Failed to delete file: ${error.message}`, 'error');
            ui.showNotification(`Deletion failed: ${error.message}`, 'error');
        }
    }

    // --- Core Download Flow ---
    // (Specific implementations are omitted to keep the example focused, but the structure remains)
    async getVideoInfo() { 
        // 1. Get URL input from UI
        // 2. Call api.getVideoInfo(url)
        // 3. On success, call ui.displayVideoInfo(info)
        // 4. On failure, call ui.showError(error)
        // ... (specific code omitted)
    }
    async startDownload() { 
        // 1. Collect download options from UI
        // 2. Call api.startDownload(url, options)
        // 3. On success, get task_id and call this.startProgressMonitoring(taskId)
        // 4. On failure, call ui.showError(error)
        // ... (specific code omitted)
    }
    startProgressMonitoring(taskId) { 
        // 1. Set up a setInterval to periodically call api.getProgress(taskId)
        // 2. After each progress fetch, call this.handleProgressUpdate(progress)
        // ... (specific code omitted)
    }
    stopProgressMonitoring() { 
        // 1. clearInterval(this.progressInterval)
        // ... (specific code omitted)
    }
    handleProgressUpdate(progress) {
        // 1. Call ui.updateProgress(progress)
        // 2. If progress.status is 'completed' or 'error', call this.stopProgressMonitoring()
        // ... (specific code omitted)
    }
    
    /**
     * Performs cleanup tasks before the application closes.
     */
    cleanup() {
        this.stopProgressMonitoring();
        ui.addLog('Application is closing...');
    }
}

// --- Global Scope ---
let app; // Global app instance

// When the DOM is fully loaded, create the App instance and start the initialization process.
document.addEventListener('DOMContentLoaded', async () => {
    app = new App();
    await app.init();
});

// Listen for the window close event to perform cleanup.
window.addEventListener('beforeunload', () => {
    app?.cleanup();
});

// --- Global Functions ---
// These functions are exposed in the global scope so that onclick events in HTML can call them directly.
// They simply act as proxies, forwarding the calls to the app instance.
function getVideoInfo() { app.getVideoInfo(); }
function startDownload() { app.startDownload(); }
function toggleLog() { ui.toggleLog(); }
function clearLog() { ui.clearLog(); }
function openDownloadsFolder() { app.openDownloadsFolder(); }