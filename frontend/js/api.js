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
     * This must be called once before any other API methods are used.
     * @param {number} port The port number the backend server is running on.
     * @returns {Promise<void>} A promise that resolves when initialization is complete.
     */
    initialize(port) {
        if (!this._initializationPromise) {
            this._initializationPromise = new Promise((resolve, reject) => {
                if (!port) {
                    return reject(new Error("API Initialization failed: Port not provided."));
                }
                this._baseUrl = `http://127.0.0.1:${port}/api`;
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
        await this._initializationPromise;

        const url = `${this._baseUrl}${endpoint}`;
        const config = {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            ...options,
        };

        if (config.body && typeof config.body !== 'string') {
            config.body = JSON.stringify(config.body);
        }

        try {
            const response = await fetch(url, config);
            const responseData = await response.json();

            if (!responseData.success) {
                // Use the server's error message if available, otherwise provide a fallback.
                throw new Error(responseData.error || `HTTP error! Status: ${response.status}`);
            }
            return responseData;
        } catch (error) {
            console.error(`API Request Failed to ${endpoint}: ${error.message}`);
            // Re-throw the error so the calling layer (main.js) can handle it.
            throw error;
        }
    }

    // --- Core Business APIs ---

    /**
     * Fetches metadata for a given video URL.
     * @param {string} videoUrl - The URL of the video.
     * @returns {Promise<object>} Video information object from the backend.
     */
    async getVideoInfo(videoUrl) {
        const response = await this._request('/info', {
            method: 'POST',
            body: { url: videoUrl },
        });
        return response.info;
    }

    /**
     * Starts a new download task.
     * @param {string} url - The video URL.
     * @param {object} options - User-selected download options.
     * @returns {Promise<string>} The ID of the created task.
     */
    async startDownload(url, options) {
        const response = await this._request('/download', {
            method: 'POST',
            body: { url, options },
        });
        return response.task_id;
    }

    /**
     * Starts a batch download task.
     * @param {string[]} urls - An array of video URLs.
     * @returns {Promise<{message: string, created_tasks: Array<{task_id: string, url: string}>}>} An object containing the success message and a list of created tasks.
     */
    async startBatchDownload(urls) {
        // --- MODIFICATION START ---
        // Return the entire response object so the controller can access both 
        // the message and the list of created task IDs.
        const response = await this._request('/batch-download', {
            method: 'POST',
            body: { urls },
        });
        return response; 
        // --- MODIFICATION END ---
    }

    /**
     * Gets the progress of a specific download task.
     * @param {string} taskId - The ID of the task.
     * @returns {Promise<object>} The task status object.
     */
    async getTaskProgress(taskId) {
        // This endpoint might return non-successful statuses (like 404),
        // so we handle it more directly without the wrapper's success check.
        await this._initializationPromise;
        const response = await fetch(`${this._baseUrl}/progress/${taskId}`);
        return response.json();
    }

    /**
     * Gets the list of downloaded files.
     * @returns {Promise<Array<object>>} A list of file objects.
     */
    async getDownloadHistory() {
        const response = await this._request('/downloads');
        return response.files;
    }

    /**
     * Deletes a specific file from the downloads directory.
     * @param {string} filename - The name of the file to delete.
     * @returns {Promise<string>} A success message.
     */
    async deleteFile(filename) {
        const response = await this._request('/delete', {
            method: 'POST',
            body: { filename },
        });
        return response.message;
    }

    // --- Configuration Management APIs ---

    /**
     * Gets the current application configuration.
     * @returns {Promise<object>} The configuration object.
     */
    async getConfig() {
        const response = await this._request('/config');
        return response.config;
    }

    /**
     * Updates the application configuration.
     * @param {object} newConfig - The new configuration data.
     * @returns {Promise<string>} A success message.
     */
    async updateConfig(newConfig) {
        const response = await this._request('/config', {
            method: 'POST',
            body: newConfig,
        });
        return response.message;
    }

    // --- Cookie Management APIs ---

    /**
     * Gets the current cookies content.
     * @returns {Promise<string>} The cookie content as a string.
     */
    async getCookies() {
        const response = await this._request('/cookies');
        return response.cookies;
    }

    /**
     * Updates the cookies file on the backend.
     * @param {string} cookies - The new cookie content.
     * @returns {Promise<string>} A success message.
     */
    async updateCookies(cookies) {
        const response = await this._request('/cookies', {
            method: 'POST',
            body: { cookies },
        });
        return response.message;
    }
}

// Export a singleton instance to ensure a single point of communication.
const api = new API();