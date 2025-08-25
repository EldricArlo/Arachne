// frontend/js/api.js - UPDATED TO USE THE NEW PRELOAD API

class API {
    constructor() {
        this.baseURL = '';
        this.currentTaskId = null;
        this.isInitialized = false;
        // initializationPromise 会在构造函数中自动开始执行
        this.initializationPromise = this.init();
    }

    // init 方法现在调用新的 preload API 并设置 baseURL
    async init() {
        try {
            console.log('Waiting for backend to be ready...');
            // 调用我们新的、返回 Promise 的 preload 函数
            const port = await window.electronAPI.waitForBackend();
            if (port) {
                this.baseURL = `http://localhost:${port}/api`;
                this.isInitialized = true;
                console.log(`API baseURL set to: ${this.baseURL}`);
            } else {
                throw new Error('Received an invalid port from the main process.');
            }
        } catch (error) {
            console.error('Failed to initialize API:', error);
            // 这里可以添加UI提示，告知用户后端启动失败
            document.body.innerHTML = `<h1>后端服务启动失败</h1><p>请检查日志并重启应用。</p><p>错误: ${error.message}</p>`;
        }
    }

    // _ensureInitialized 帮助每个请求等待 init() 完成
    async _ensureInitialized() {
        // 如果初始化 Promise 还在进行中，等待它完成
        if (this.initializationPromise) {
            await this.initializationPromise;
        }
        // 如果初始化失败，抛出错误，阻止发送无效请求
        if (!this.isInitialized) {
            throw new Error("API is not initialized. Backend may have failed to start.");
        }
    }

    async request(endpoint, options = {}) {
        await this._ensureInitialized(); // 每个请求前都确保已初始化

        const url = `${this.baseURL}${endpoint}`;
        const config = {
            headers: { 'Content-Type': 'application/json' },
            ...options
        };

        try {
            const response = await fetch(url, config);
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || `HTTP ${response.status}`);
            }
            return data;
        } catch (error) {
            console.error('API request failed:', error);
            throw error;
        }
    }

    // --- 剩下的所有方法 (getVideoInfo, startDownload, etc.) 保持完全不变 ---

    async getVideoInfo(url) {
        return await this.request('/info', { method: 'POST', body: JSON.stringify({ url }) });
    }
    async startDownload(url, options) {
        const response = await this.request('/download', { method: 'POST', body: JSON.stringify({ url, options }) });
        this.currentTaskId = response.task_id;
        return response;
    }
    async getProgress(taskId) {
        return await this.request(`/progress/${taskId}`);
    }
    async getDownloads() {
        return await this.request('/downloads');
    }
    async deleteFile(filename) {
        return await this.request('/delete', { method: 'POST', body: JSON.stringify({ filename }) });
    }
    getCurrentTaskId() {
        return this.currentTaskId;
    }
    clearCurrentTaskId() {
        this.currentTaskId = null;
    }
    async checkStatus() {
        try {
            await this._ensureInitialized();
            const response = await fetch(`${this.baseURL}/status`);
            return response.ok;
        } catch (error) {
            return false;
        }
    }

    // --- 静态方法保持不变 ---
    static formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    static formatDuration(seconds) {
        if (!seconds || seconds <= 0) return '未知';
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        } else {
            return `${minutes}:${secs.toString().padStart(2, '0')}`;
        }
    }
    static formatNumber(num) {
        if (!num || num <= 0) return '0';
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        } else if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'K';
        } else {
            return num.toString();
        }
    }
    static isValidYouTubeURL(url) {
        const patterns = [
            /^https?:\/\/(?:www\.)?youtube\.com\/watch\?v=[\w-]+/,
            /^https?:\/\/youtu\.be\/[\w-]+/,
            /^https?:\/\/(?:www\.)?youtube\.com\/playlist\?list=[\w-]+/,
            /^https?:\/\/(?:www\.)?youtube\.com\/channel\/[\w-]+/,
            /^https?:\/\/(?:www\.)?youtube\.com\/@[\w-]+/
        ];
        return patterns.some(pattern => pattern.test(url));
    }
}

const api = new API();