// --- api.js ---
// Responsibility: All communication with the backend HTTP API. It is the sole
// gateway to the outside world, abstracting away network complexities.

class API {
    /**
     * Enforces the singleton pattern.
     */
    constructor() {
        if (API._instance) {
            return API._instance;
        }
        API._instance = this;

        this._baseUrl = null;
        this._initializationPromise = null;
    }

    /**
     * Initializes the API module by setting the base URL from a dynamic port.
     * This must be called once before any other API methods are used. It simulates
     * waiting for a main process (like Electron) to start the backend server.
     * @param {number} port The port number the backend server is running on.
     * @returns {Promise<void>} A promise that resolves when initialization is complete.
     */
    initialize(port) {
        if (!this._initializationPromise) {
            this._initializationPromise = new Promise((resolve, reject) => {
                if (!port) {
                    return reject(new Error("API Initialization failed: Port not provided."));
                }
                this._baseUrl = `http://localhost:${port}/api`;
                console.log(`API layer initialized. Base URL: ${this._baseUrl}`);
                resolve();
            });
        }
        return this._initializationPromise;
    }
    
    /**
     * A generic, private request wrapper for all fetch calls. It centralizes
     * error handling, headers, and request configuration.
     * @private
     * @param {string} endpoint - The API endpoint to call (e.g., '/info').
     * @param {object} [options={}] - Configuration for the fetch request.
     * @returns {Promise<any>} The JSON response from the server.
     * @throws {Error} Throws a formatted error if the request fails.
     */
    async _request(endpoint, options = {}) {
        // Ensure the API is initialized before allowing any requests to proceed.
        await this._initializationPromise; 
        
        const url = `${this._baseUrl}${endpoint}`;
        
        const config = {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            ...options,
        };

        if (config.body) {
            config.body = JSON.stringify(config.body);
        }

        try {
            const response = await fetch(url, config);
            const responseData = await response.json();

            if (!response.ok) {
                // Use the server's error message if available, otherwise provide a fallback.
                throw new Error(responseData.message || `HTTP error! Status: ${response.status}`);
            }
            return responseData;
        } catch (error) {
            console.error(`API Request Failed: ${error.message}`);
            // Re-throw the error so the calling layer (main.js) can handle it.
            throw error;
        }
    }
    
    // --- Public API Methods ---

    /**
     * Fetches metadata for a given video URL.
     * @param {string} videoUrl - The URL of the video.
     * @returns {Promise<object>} Video information (title, thumbnail, etc.).
     */
    getVideoInfo(videoUrl) {
        // MOCK IMPLEMENTATION
        return new Promise((resolve, reject) => {
            console.log(`Fetching info for: ${videoUrl}`);
            if (!videoUrl.includes('youtube.com')) {
                return setTimeout(() => reject(new Error('Invalid URL. Only YouTube is supported in this mock.')), 1000);
            }
            setTimeout(() => {
                resolve({
                    title: "Building the Perfect UI - A Developer's Journey",
                    author: "DesignCode",
                    duration: "12:34",
                    thumbnail: "https://i.ytimg.com/vi/placeholder/maxresdefault.jpg"
                });
            }, 1500);
        });
    }

    /**
     * Gets the current application configuration from the backend.
     * @returns {Promise<object>} The current configuration object.
     */
    getConfig() {
        // MOCK IMPLEMENTATION
        return new Promise(resolve => {
            setTimeout(() => {
                resolve({
                    downloadPath: "/Users/Shared/AuroraDownloads",
                    videoQuality: "1080p",
                    maxConcurrent: 3,
                });
            }, 200);
        });
    }

    /**
     * Sends new configuration data to the backend to be saved.
     * @param {object} configData - The new settings to save.
     * @returns {Promise<object>} The updated configuration object from the server.
     */
    updateConfig(configData) {
        // MOCK IMPLEMENTATION
        return new Promise(resolve => {
            console.log("Saving new config:", configData);
            setTimeout(() => resolve(configData), 500);
        });
    }
}

// Export a singleton instance to ensure a single point of communication.
const api = new API();