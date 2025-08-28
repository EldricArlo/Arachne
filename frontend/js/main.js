// --- main.js ---
// Responsibility: Application's main logic, state management, and orchestration.
// It acts as the "controller", connecting the UI and API layers.

class App {
    /**
     * Enforces the singleton pattern.
     */
    constructor() {
        if (App._instance) {
            return App._instance;
        }
        App._instance = this;

        // --- Application State ---
        this.config = {}; // Holds all user settings from config.yaml
        this.profile = {}; // Holds user profile data { userName, avatarUrl, avatarPosition }
        this.currentVideoInfo = null; // Holds info of the last fetched video
        this.activeTasks = new Map(); // Tracks ongoing downloads { task_id: { status, percent, ... } }
        this.progressInterval = null; // Holds the setInterval ID for progress polling
    }

    /**
     * The main entry point for the application. It orchestrates the
     * entire initialization sequence in the correct order.
     */
    async init() {
        console.log('App starting...');

        try {
            // 1. Get the real backend port from the Electron main process.
            const backendPort = await window.electronAPI.waitForBackend();
            console.log(`Backend port received: ${backendPort}`);

            // 2. Initialize the API layer with the correct port.
            await api.initialize(backendPort);

            // 3. Initialize the UI layer, passing it all the necessary handler methods.
            ui.initialize({
                // Core functionality
                onGetInfo: this.handleGetVideoInfo.bind(this),
                onDownload: this.handleDownload.bind(this),
                onStartBatch: this.handleStartBatchDownload.bind(this),
                onSwitchView: this.handleSwitchView.bind(this),
                onRefreshHistory: this.handleRefreshHistory.bind(this),
                // Native interactions
                onOpenFile: this.handleOpenFile.bind(this),
                onDeleteFile: this.handleDeleteFile.bind(this),
                onOpenDownloadsFolder: this.handleOpenDownloadsFolder.bind(this),
                onSelectFolder: this.handleSelectDownloadsFolder.bind(this),
                // Settings
                onShowSettings: this.handleShowSettings.bind(this),
                onSaveSettings: this.handleSaveSettings.bind(this),
                // Profile
                onLoadProfile: this.handleLoadProfile.bind(this),
                onShowProfile: this.handleShowProfile.bind(this),
                onSaveProfile: this.handleSaveProfile.bind(this),
                onSelectLocalAvatar: this.handleSelectLocalAvatar.bind(this),
            });
            
            // 4. Listen for actions triggered from the main process menu.
            window.electronAPI.onMenuAction((action) => {
                if (action === 'open-downloads-folder') {
                    this.handleOpenDownloadsFolder();
                }
            });

            // 5. Load initial configuration from backend and set the default view.
            await this.loadInitialConfig();
            ui.switchView('single');

        } catch (error) {
            console.error("Fatal error during app initialization:", error);
            ui.showFatalError("Could not connect to the backend service. Please try restarting the application.");
        }
    }

    /**
     * Loads the initial configuration from the backend.
     */
    async loadInitialConfig() {
        try {
            this.config = await api.getConfig();
            console.log('Initial config loaded:', this.config);
        } catch (error) {
            console.error("Failed to load initial config:", error);
            // If backend fails to provide config, use sensible defaults to avoid crashes.
            this.config = { downloads_dir: 'downloads' }; 
        }
    }

    // --- ORCHESTRATION LOGIC / EVENT HANDLERS ---

    /**
     * Handles the entire business flow for fetching video information.
     * @param {string} url - The video URL from the UI.
     */
    async handleGetVideoInfo(url) {
        if (!url || !url.trim()) {
            ui.displayError('Please enter a valid URL.');
            return;
        }
        ui.setLoadingState(ui.getInfoBtn, true);
        ui.clearVideoInfo();
        try {
            const videoInfo = await api.getVideoInfo(url);
            this.currentVideoInfo = { ...videoInfo, originalUrl: url };
            ui.displayVideoInfo(this.currentVideoInfo);
        } catch (error) {
            ui.displayError(error.message || 'An unknown error occurred.');
            this.currentVideoInfo = null;
        } finally {
            ui.setLoadingState(ui.getInfoBtn, false);
        }
    }

    /**
     * Handles the download request for the currently displayed video.
     * @param {object} options - Download options (quality, format, audioOnly) from the UI.
     */
    async handleDownload(options) {
        if (!this.currentVideoInfo?.originalUrl) return;

        ui.showToast('Download has been added to the queue.');

        try {
            const taskId = await api.startDownload(this.currentVideoInfo.originalUrl, options);
            const taskData = {
                id: taskId,
                status: 'queued',
                percent: 0,
                title: this.currentVideoInfo.title,
                thumbnail: this.currentVideoInfo.thumbnail,
            };
            this.activeTasks.set(taskId, taskData);

            ui.addTaskToSingleView(taskData);
            
            this._startProgressPolling();

            this.currentVideoInfo = null;
            ui.clearVideoInfo();
        } catch (error) {
            ui.showToast(`Error: ${error.message}`, 'error');
        }
    }

    /**
     * Handles starting a batch download.
     */
    async handleStartBatchDownload() {
        const urls = ui.getBatchUrls();
        if (urls.length === 0) {
            ui.showToast("Please enter at least one URL.", 'error');
            return;
        }
        
        ui.setLoadingState(ui.batchDownloadBtn, true);
        try {
            // --- MODIFICATION: Destructure response and add robust checking ---
            const { message, created_tasks, failed_urls } = await api.startBatchDownload(urls);

            ui.showToast(message);
            
            // Log failed URLs for debugging if any exist
            if (failed_urls && failed_urls.length > 0) {
                console.warn("Some URLs failed to queue:", failed_urls);
            }

            if (created_tasks && created_tasks.length > 0) {
                created_tasks.forEach(task => {
                    // Ensure task and task_id exist before proceeding
                    if (task && task.task_id) {
                        const taskData = {
                            id: task.task_id,
                            status: 'queued',
                            percent: 0,
                            title: task.url, // In batch, title is initially the URL
                            thumbnail: '', // No thumbnail available at this stage
                        };
                        this.activeTasks.set(task.task_id, taskData);
                        ui.addOrUpdateTask(taskData);
                    }
                });
                this._startProgressPolling();
                ui.clearBatchUrls();
                ui.switchView('history');
            }

        } catch (error) {
            ui.showToast(`Error: ${error.message}`, 'error');
        } finally {
            ui.setLoadingState(ui.batchDownloadBtn, false);
        }
    }
    
    /**
     * Starts/maintains the progress polling interval for active downloads.
     * @private
     */
    _startProgressPolling() {
        if (this.progressInterval) return;
        console.log("Starting progress polling.");

        this.progressInterval = setInterval(async () => {
            if (this.activeTasks.size === 0) {
                console.log("No active tasks. Stopping polling.");
                clearInterval(this.progressInterval);
                this.progressInterval = null;
                this.handleRefreshHistory();
                ui.clearSingleViewTasks();
                return;
            }

            // Create a snapshot of keys to prevent issues with map modification during iteration
            const taskIds = [...this.activeTasks.keys()];
            for (const taskId of taskIds) {
                try {
                    const progressStatus = await api.getTaskProgress(taskId);
                    
                    const existingTask = this.activeTasks.get(taskId);
                    if (!existingTask) continue; 

                    const updatedTask = { ...existingTask, ...progressStatus, id: taskId };
                    
                    this.activeTasks.set(taskId, updatedTask);
                    ui.addOrUpdateTask(updatedTask);

                    if (['completed', 'error', 'not_found'].includes(progressStatus.status)) {
                        this.activeTasks.delete(taskId);
                    }
                } catch (error) {
                    console.error(`Error polling task ${taskId}:`, error);
                    this.activeTasks.delete(taskId);
                }
            }
        }, 1000);
    }

    /**
     * Handles logic when switching between UI views.
     * @param {string} viewName - The name of the view to switch to.
     */
    handleSwitchView(viewName) {
        if (viewName === 'history') {
            this.handleRefreshHistory();
        }
        ui.switchView(viewName);
    }
    
    /**
     * Fetches and displays the download history.
     */
    async handleRefreshHistory() {
        try {
            const files = await api.getDownloadHistory();
            ui.renderHistory(files, this.activeTasks);
        } catch (error) {
            ui.showToast(`Failed to load history: ${error.message}`, 'error');
        }
    }
    
    /**
     * Handles a request to open a downloaded file's path.
     * @param {string} filePath - The absolute path to the file.
     */
    handleOpenFile(filePath) {
        window.electronAPI.openPath({
            filePath: filePath,
            downloadsPath: this.config.downloads_dir
        });
    }

    /**
     * Handles a request to delete a downloaded file.
     * @param {string} filename - The name of the file to delete.
     */
    async handleDeleteFile(filename) {
        const confirmed = await window.electronAPI.showConfirmDialog(`Are you sure you want to delete "${filename}"? This action cannot be undone.`);
        if (confirmed) {
            try {
                await api.deleteFile(filename);
                ui.showToast(`"${filename}" was deleted.`);
                this.handleRefreshHistory();
            } catch (error) {
                ui.showToast(`Error deleting file: ${error.message}`, 'error');
            }
        }
    }

    /**
     * Opens the user's configured downloads directory.
     */
    handleOpenDownloadsFolder() {
        if (this.config.downloads_dir) {
            window.electronAPI.openDownloadsFolder(this.config.downloads_dir);
        } else {
            ui.showToast("Download directory is not set.", "error");
        }
    }

    /**
     * Shows the settings modal and populates it with current config.
     */
    async handleShowSettings() {
        await this.loadInitialConfig();
        ui.loadSettings(this.config);
        ui.toggleSettingsModal(true);
    }

    /**
     * Handles saving new settings from the settings modal.
     */
    async handleSaveSettings() {
        const newConfigData = ui.collectSettings();
        try {
            await api.updateConfig(newConfigData);
            this.config = await api.getConfig(); // Re-fetch config to get resolved paths from backend
            ui.showToast('Settings saved successfully!');
            ui.toggleSettingsModal(false);
        } catch (error) {
            ui.showToast(`Failed to save settings: ${error.message}`, 'error');
        }
    }
    
    /**
     * Handles the request to select a new downloads folder using the native dialog.
     */
    async handleSelectDownloadsFolder() {
        const selectedPath = await window.electronAPI.selectDownloadsFolder();
        if (selectedPath) {
            ui.updateDownloadsPathInput(selectedPath);
        }
    }
    
    // --- PROFILE HANDLERS ---

    /**
     * Loads profile data from localStorage on app start and updates the UI.
     */
    handleLoadProfile() {
        const savedProfile = localStorage.getItem('userProfile');
        const defaultProfile = {
            userName: 'Jane Doe',
            avatarUrl: 'https://i.pravatar.cc/60',
            avatarPosition: 'center'
        };
        
        let profileData = defaultProfile;
        if (savedProfile) {
            try {
                // Safely merge saved data with defaults
                profileData = { ...defaultProfile, ...JSON.parse(savedProfile) };
            } catch (e) {
                console.error("Failed to parse profile data from localStorage", e);
            }
        }
        
        this.profile = profileData;
        ui.loadProfile(this.profile);
    }

    /**
     * Handles showing the profile editor modal and populating it with current data.
     */
    handleShowProfile() {
        ui.populateProfileForm(this.profile);
        ui.toggleProfileModal(true);
    }

    /**
     * Handles saving new profile settings to state and localStorage.
     */
    handleSaveProfile() {
        const newProfileData = ui.collectProfileSettings();
        
        // Update state with new data, falling back to existing data if new data is empty
        this.profile.userName = newProfileData.userName || this.profile.userName;
        this.profile.avatarUrl = newProfileData.avatarUrl || this.profile.avatarUrl;
        this.profile.avatarPosition = newProfileData.avatarPosition || 'center';
        
        localStorage.setItem('userProfile', JSON.stringify(this.profile));

        ui.loadProfile(this.profile);
        ui.toggleProfileModal(false);
        ui.showToast('Profile updated successfully!');
    }
    
    /**
     * Handles the request to select a local image as an avatar.
     */
    async handleSelectLocalAvatar() {
        try {
            const dataUri = await window.electronAPI.selectProfileImage();
            if (dataUri) {
                ui.updateAvatarUrlInput(dataUri);
            }
        } catch (error) {
            console.error("Error selecting local avatar:", error);
            ui.showToast("Failed to select image.", "error");
        }
    }
}

// Create and export a singleton instance to ensure a single, central controller.
const app = new App();