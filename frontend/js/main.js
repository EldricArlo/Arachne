// frontend/js/main.js

/**
 * Main Application Class (App).
 * 
 * Responsible for core business logic and application state management. It acts as the
 * coordinator between the UI (ui.js) and the API (api.js).
 */
class App {
    constructor() {
        this.progressInterval = null; // Timer ID for polling download progress
        this.config = null;           // Stores the application configuration loaded from the backend
        this.currentURL = null;       // Stores the URL of the video currently being processed
    }

    /**
     * Asynchronously initializes the application.
     * This is the entry point for starting the app.
     */
    async init() {
        await api.initializationPromise;
        this.setupMenuListener();
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
            if (action === 'open-downloads-folder') {
                this.openDownloadsFolder();
            }
        });
    }

    /**
     * Checks the connection status of the backend service.
     */
    async checkBackendStatus() {
        try {
            const isOnline = await api.checkStatus();
            if (isOnline) {
                ui.addLog('Backend service connected successfully', 'success');
            } else {
                throw new Error('Backend service did not respond');
            }
        } catch (error) {
            ui.showError(error);
        }
    }

    /**
     * Loads the application configuration from the backend.
     */
    async loadConfig() {
        try {
            ui.addLog('Loading application configuration...');
            const response = await api.getConfig();
            if (response.success) {
                this.config = response.config;
                ui.addLog('Application configuration loaded successfully');
                console.log('Current configuration:', this.config);
            } else {
                throw new Error(response.error || 'Failed to get configuration');
            }
        } catch (error) {
            ui.showError(error);
            ui.showNotification('Failed to load config, will use defaults', 'error');
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
            ui.showError(error);
        }
    }

    /**
     * Opens the downloads folder by invoking the main process.
     */
    openDownloadsFolder() {
        if (this.config && this.config.downloads_dir) {
            ui.addLog(`Requesting to open downloads folder: ${this.config.downloads_dir}`);
            window.electronAPI.openDownloadsFolder(this.config.downloads_dir);
        } else {
            const msg = 'Cannot open downloads folder: configuration or path not available.';
            ui.addLog(msg, 'error');
            ui.showNotification(msg, 'error');
        }
    }

    /**
     * Deletes a specific file after user confirmation.
     * @param {string} filename - The name of the file to delete.
     */
    async deleteFile(filename) {
        if (!filename) return;
        try {
            const confirmed = await window.electronAPI.showConfirmDialog(
                `Are you sure you want to delete the file "${filename}"?\nThis action cannot be undone.`
            );

            if (confirmed) {
                ui.addLog(`User confirmed deletion of file: ${filename}`);
                await api.deleteFile(filename);
                ui.showNotification(`File "${filename}" has been deleted`, 'success');
                await ui.loadDownloadHistory();
            } else {
                ui.addLog(`User canceled the delete operation for: ${filename}`);
            }
        } catch (error) {
            ui.showError(error);
        }
    }

    // --- Core Download Flow ---

    /**
     * Fetches video information from the backend and updates the UI.
     */
    async getVideoInfo() {
        this.currentURL = ui.elements.urlInput.value.trim();
        if (!this.currentURL) {
            ui.showNotification('Please enter a valid URL', 'error');
            return;
        }

        ui.resetUI();
        ui.setLoadingState(ui.elements.infoBtn, true, 'Get Info');
        ui.addLog(`Fetching info for URL: ${this.currentURL}`);

        try {
            const response = await api.getVideoInfo(this.currentURL);
            if (response.success) {
                ui.addLog(`Successfully fetched info: "${response.info.title}"`, 'success');
                ui.displayVideoInfo(response.info);
            } else {
                throw new Error(response.error);
            }
        } catch (error) {
            ui.showError(error);
        } finally {
            ui.setLoadingState(ui.elements.infoBtn, false, 'Get Info');
        }
    }

    /**
     * Starts the download process.
     */
    async startDownload() {
        if (!this.currentURL) {
            ui.showNotification('No URL to download. Please get video info first.', 'error');
            return;
        }

        const options = ui.collectDownloadOptions();
        ui.toggleUIState(true);
        ui.setLoadingState(ui.elements.downloadBtn, true, '🚀 Start Download');
        ui.addLog(`Starting download for "${this.currentURL}" with options: ${JSON.stringify(options)}`);

        try {
            const response = await api.startDownload(this.currentURL, options);
            if (response.success && response.task_id) {
                ui.addLog(`Download task created with ID: ${response.task_id}`, 'success');
                this.startProgressMonitoring(response.task_id);
            } else {
                throw new Error(response.error || 'Failed to start download task.');
            }
        } catch (error) {
            ui.showError(error);
            ui.toggleUIState(false);
            ui.setLoadingState(ui.elements.downloadBtn, false, '🚀 Start Download');
        }
    }

    /**
     * Starts polling for download progress.
     * @param {string} taskId - The ID of the task to monitor.
     */
    startProgressMonitoring(taskId) {
        this.stopProgressMonitoring(); // Ensure no other polling is active

        this.progressInterval = setInterval(async () => {
            try {
                const progress = await api.getProgress(taskId);
                this.handleProgressUpdate(progress);
            } catch (error) {
                ui.addLog(`Error polling progress: ${error.message}`, 'error');
                this.stopProgressMonitoring();
            }
        }, 1000); // Poll every 1 second
    }

    /**
     * Stops the progress polling interval.
     */
    stopProgressMonitoring() {
        if (this.progressInterval) {
            clearInterval(this.progressInterval);
            this.progressInterval = null;
            api.clearCurrentTaskId();
            ui.addLog('Progress monitoring stopped.');
        }
    }

    /**
     * Handles progress updates from the backend.
     * @param {object} progress - The progress data object.
     */
    handleProgressUpdate(progress) {
        if (!progress) return;

        ui.updateProgress(progress);

        const isFinished = progress.status === 'completed' || progress.status === 'error';
        if (isFinished) {
            this.stopProgressMonitoring();
            ui.toggleUIState(false);
            ui.setLoadingState(ui.elements.downloadBtn, false, '🚀 Start Download');

            if (progress.status === 'completed') {
                ui.showNotification('Download completed successfully!', 'success');
                ui.addLog('Task completed successfully.', 'success');
            } else {
                ui.showNotification(`Download failed: ${progress.error}`, 'error');
                ui.addLog(`Task failed: ${progress.error}`, 'error');
            }
            // Refresh the downloads list after any task finishes
            ui.loadDownloadHistory();
        }
    }

    /**
     * Performs cleanup tasks before the application closes.
     */
    cleanup() {
        this.stopProgressMonitoring();
        ui.addLog('Application is closing...');
    }

    /**
 * 新增: 处理选择下载文件夹的逻辑
 */
    async selectDownloadsFolder() {
        ui.addLog('Opening folder selection dialog...');
        try {
            // 调用通过 preload 暴露的函数
            const selectedPath = await window.electronAPI.selectDownloadsFolder();

            if (selectedPath) {
                ui.addLog(`User selected a new downloads folder: ${selectedPath}`, 'success');
                // 调用 UI 方法来更新输入框
                ui.updateDownloadsDirInput(selectedPath);
            } else {
                ui.addLog('User canceled folder selection.');
            }
        } catch (error) {
            ui.showError(error);
        }
    }

}

// --- Global Scope ---
let app;

document.addEventListener('DOMContentLoaded', async () => {
    app = new App();
    await app.init();
});

window.addEventListener('beforeunload', () => {
    app?.cleanup();
});

// --- Global Functions for HTML onclick ---
function getVideoInfo() { app.getVideoInfo(); }
function startDownload() { app.startDownload(); }
function toggleLog() { ui.toggleLog(); }
function clearLog() { ui.clearLog(); }
function openDownloadsFolder() { app.openDownloadsFolder(); }
function selectDownloadsFolder() { app.selectDownloadsFolder(); }