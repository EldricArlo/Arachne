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
        
        // This holds the application's state.
        this.config = {};
    }
    
    /**
     * The main entry point for the application. It orchestrates the
     * entire initialization sequence in the correct order.
     */
    async init() {
        console.log('App starting...');
        
        try {
            // 1. Simulate getting the backend port (e.g., from Electron's main process).
            const backendPort = await this._getBackendPort();
            
            // 2. Initialize the API layer. This must complete before any other steps.
            await api.initialize(backendPort);
            
            // 3. Initialize the UI layer, passing it the handler methods from this controller.
            // We use .bind(this) to ensure 'this' refers to the App instance inside the handlers.
            ui.initialize({
                onGetInfo: this.handleGetVideoInfo.bind(this),
                onShowSettings: this.handleShowSettings.bind(this),
                onSaveSettings: this.handleSaveSettings.bind(this)
            });

            // 4. Load initial configuration from the backend and store it in our state.
            this.config = await api.getConfig();
            console.log('Initial config loaded:', this.config);
            
        } catch (error) {
            console.error("Fatal error during app initialization:", error);
            // In a real app, you would show a critical, non-closable error message to the user here.
        }
    }
    
    /**
     * Simulates an asynchronous process to get the backend port.
     * @private
     * @returns {Promise<number>} A promise that resolves with the port number.
     */
    _getBackendPort() {
        return new Promise(resolve => {
            console.log("Waiting for backend port...");
            // Simulate a short delay as if waiting for the backend to start
            setTimeout(() => {
                const port = 3000; // Mock port
                console.log(`Backend port received: ${port}`);
                resolve(port);
            }, 500);
        });
    }
    
    // --- EVENT HANDLERS (ORCHESTRATION LOGIC) ---

    /**
     * Handles the entire business flow for fetching video information.
     * @param {string} url - The video URL from the UI.
     */
    async handleGetVideoInfo(url) {
        if (!url) {
            ui.displayError('Please enter a valid URL.');
            return;
        }
        
        // 1. Command UI to enter loading state.
        ui.setLoadingState(ui.getInfoBtn, true);
        ui.clearVideoInfo();

        try {
            // 2. Call API to fetch data.
            const videoInfo = await api.getVideoInfo(url);
            
            // 3. Command UI to render the received data.
            ui.displayVideoInfo(videoInfo);
        } catch (error) {
            // 4. Command UI to show a formatted error.
            ui.displayError(error.message || 'An unknown error occurred.');
        } finally {
            // 5. Always command UI to exit loading state.
            ui.setLoadingState(ui.getInfoBtn, false);
        }
    }

    /**
     * Handles showing the settings modal and populating it with current state.
     */
    handleShowSettings() {
        ui.loadSettings(this.config);
        ui.toggleSettingsModal(true);
    }
    
    /**
     * Handles the business flow for saving new settings.
     */
    async handleSaveSettings() {
        // 1. Get new data from UI.
        const newConfigData = ui.collectSettings();
        
        try {
            // 2. Call API to save the new data.
            const updatedConfig = await api.updateConfig(newConfigData);
            
            // 3. Update local state with the confirmed new config from the server.
            this.config = updatedConfig;
            
            // 4. Command UI to close the modal and provide success feedback.
            alert('Settings saved successfully!'); // Replace with a custom toast notification in a real app
            ui.toggleSettingsModal(false);
        } catch(error) {
            // 5. Provide error feedback.
            alert(`Failed to save settings: ${error.message}`);
        }
    }
}

// Export a singleton instance to ensure a single, central controller.
const app = new App();