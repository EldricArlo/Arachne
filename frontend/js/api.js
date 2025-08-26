// frontend/js/api.js

/**
 * API Client Class.
 * 
 * This is a singleton class that encapsulates all network communication
 * with the Python backend service. It is responsible for sending requests,
 * parsing responses, and handling errors uniformly.
 * Other frontend modules (like main.js) should interact with the backend
 * through an instance of this class.
 */
class API {
    /**
     * @constructor
     * Constructs and immediately begins initializing the API client.
     * 
     * The initialization process is asynchronous because it needs to wait for the
     * Electron main process to confirm that the backend service has started and
     * returned a port number. The Promise for this process is stored in `this.initializationPromise`.
     * Other parts of the application can `await` it to ensure the API is ready.
     */
    constructor() {
        this.baseURL = '';
        this.currentTaskId = null;
        this.isInitialized = false;

        // Key: Store the Promise returned by init().
        // The main application logic (main.js) will `await` this Promise,
        // ensuring that the backend connection is established before any API calls are made.
        this.initializationPromise = this.init();
    }

    /**
     * Asynchronously initializes the API module.
     * 
     * It safely waits for the main process to signal that the backend is ready and
     * obtains its dynamic port number through the `waitForBackend` method exposed
     * by the preload script.
     */
    async init() {
        try {
            console.log('API: Waiting for backend service to be ready...');
            // This is the key step: calling the method exposed in the preload script.
            // It returns a Promise that resolves only after the main process sends the port.
            const port = await window.electronAPI.waitForBackend();

            if (port) {
                this.baseURL = `http://localhost:${port}/api`;
                this.isInitialized = true;
                console.log(`API: baseURL successfully set to: ${this.baseURL}`);
            } else {
                throw new Error('Received an invalid port number from the main process.');
            }
        } catch (error) {
            console.error('API: Initialization failed:', error);
            // If initialization fails (e.g., backend crashes on startup),
            // display an error directly on the page, as the app cannot function.
            document.body.innerHTML = `
                <div style="padding: 20px; text-align: center; color: #f00;">
                    <h1>Backend Service Failed to Start</h1>
                    <p>Could not connect to the Python backend. Please check the logs and restart the application.</p>
                    <p><strong>Error details:</strong> ${error.message}</p>
                </div>
            `;
        }
    }

    /**
     * Ensures that the API has been initialized before executing a request.
     * This is an internal helper method to prevent sending requests before the backend is ready.
     * @private
     */
    async _ensureInitialized() {
        // Wait for the initialization process started in the constructor to complete.
        await this.initializationPromise;
        if (!this.isInitialized) {
            throw new Error("API not initialized. The backend may have failed to start.");
        }
    }

    /**
     * A generic method for sending network requests.
     * 
     * @param {string} endpoint - The API endpoint, e.g., '/info'.
     * @param {object} [options={}] - The options object for the fetch API (e.g., method, body).
     * @returns {Promise<object>} - The parsed JSON response data.
     * @throws {Error} - Throws an error if the request fails or the response status code is not 2xx.
     */
    async request(endpoint, options = {}) {
        await this._ensureInitialized();

        const url = `${this.baseURL}${endpoint}`;
        const config = {
            headers: { 'Content-Type': 'application/json' },
            ...options
        };

        try {
            const response = await fetch(url, config);
            // Try to parse JSON even if the status code is not 2xx, as the backend might return JSON in error responses.
            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                // Prioritize the error message provided by the backend in the JSON response.
                const errorMessage = data.error || `HTTP Error: ${response.status} ${response.statusText}`;
                throw new Error(errorMessage);
            }
            return data;
        } catch (error) {
            console.error(`API request failed: ${endpoint}`, error);
            // If the error is a TypeError, it usually indicates a network connection issue (e.g., backend is down).
            if (error instanceof TypeError) {
                throw new Error("Network connection failed. Please check if the backend service is running.");
            }
            // Re-throw other types of errors (like the Error we created above).
            throw error;
        }
    }

    // --- Configuration Management APIs ---
    async getConfig() {
        return this.request('/config');
    }
    async updateConfig(configData) {
        return this.request('/config', {
            method: 'POST',
            body: JSON.stringify(configData)
        });
    }

    // --- Core Download Flow APIs ---
    async getVideoInfo(url) {
        return this.request('/info', { method: 'POST', body: JSON.stringify({ url }) });
    }
    async startDownload(url, options) {
        const response = await this.request('/download', { method: 'POST', body: JSON.stringify({ url, options }) });
        // After successfully starting a download, save the task ID for progress polling.
        this.currentTaskId = response.task_id;
        return response;
    }
    async getProgress(taskId) {
        return this.request(`/progress/${taskId}`);
    }

    // --- File Management APIs ---
    async getDownloads() {
        return this.request('/downloads');
    }
    async deleteFile(filename) {
        return this.request('/delete', { method: 'POST', body: JSON.stringify({ filename }) });
    }

    // --- Status and Utility Methods ---
    async checkStatus() {
        try {
            await this._ensureInitialized();
            const response = await fetch(`${this.baseURL}/status`);
            return response.ok;
        } catch {
            return false;
        }
    }
    getCurrentTaskId() { return this.currentTaskId; }
    clearCurrentTaskId() { this.currentTaskId = null; }

    // --- Static Utility Methods ---
    static formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    static formatDuration(seconds) {
        return new Date(seconds * 1000).toISOString().substr(11, 8);
    }
    static formatNumber(num) {
        return new Intl.NumberFormat().format(num);
    }
}

// Create and export an API singleton for use throughout the frontend application.
const api = new API();