// frontend/js/api.js

class API {
    constructor() {
        this.baseURL = ''; // API 的基础 URL，将在 init 中设置
        this.currentTaskId = null;
        this.isInitialized = false;
        // 在构造函数中立即开始初始化过程，返回一个 Promise
        this.initializationPromise = this.init();
    }

    /**
     * 异步初始化 API 模块。
     * 它会调用 preload 脚本中暴露的 waitForBackend 函数，
     * 直到获取到后端端口号后，才完成初始化。
     */
    async init() {
        try {
            console.log('等待后端服务就绪...');
            // 这是关键步骤：等待由 preload 脚本返回的 Promise 完成
            const port = await window.electronAPI.waitForBackend();
            
            if (port) {
                this.baseURL = `http://localhost:${port}/api`;
                this.isInitialized = true;
                console.log(`API baseURL 已设置为: ${this.baseURL}`);
            } else {
                throw new Error('从主进程收到了无效的端口号。');
            }
        } catch (error) {
            console.error('API 初始化失败:', error);
            // 如果初始化失败，直接在页面上显示错误，因为应用无法正常工作
            document.body.innerHTML = `<h1>后端服务启动失败</h1><p>请检查日志并重启应用。</p><p>错误: ${error.message}</p>`;
        }
    }

    /**
     * 确保 API 已经初始化完成。
     * 每个 API 请求方法在执行前都会调用此函数，
     * 以确保不会在后端就绪前发送请求。
     */
    async _ensureInitialized() {
        // 等待在构造函数中开始的初始化 Promise
        if (this.initializationPromise) {
            await this.initializationPromise;
        }
        // 如果在等待后仍然未初始化成功，则抛出错误
        if (!this.isInitialized) {
            throw new Error("API 未初始化。后端可能启动失败。");
        }
    }

    /**
     * 发送网络请求的通用方法。
     * @param {string} endpoint - API 端点，如 '/info'。
     * @param {object} options - fetch API 的选项。
     * @returns {Promise<object>} - 解析后的 JSON 数据。
     */
    async request(endpoint, options = {}) {
        await this._ensureInitialized(); // 确保已初始化

        const url = `${this.baseURL}${endpoint}`;
        const config = {
            headers: { 'Content-Type': 'application/json' },
            ...options
        };

        try {
            const response = await fetch(url, config);
            const data = await response.json();
            if (!response.ok) {
                // 如果后端返回错误，抛出包含错误信息的 Error
                throw new Error(data.error || `HTTP 错误: ${response.status}`);
            }
            return data;
        } catch (error) {
            console.error(`API 请求失败: ${endpoint}`, error);
            throw error; // 重新抛出错误，以便调用者可以捕获
        }
    }

    // --- API 端点方法 ---

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
    
    async checkStatus() {
        try {
            await this._ensureInitialized();
            const response = await fetch(`${this.baseURL}/status`);
            return response.ok;
        } catch (error) {
            return false;
        }
    }

    getCurrentTaskId() {
        return this.currentTaskId;
    }
    
    clearCurrentTaskId() {
        this.currentTaskId = null;
    }

    // --- 静态工具方法 ---

    static formatFileSize(bytes) {
        // ... (代码无变化)
    }
    static formatDuration(seconds) {
        // ... (代码无变化)
    }
    static formatNumber(num) {
        // ... (代码无变化)
    }
    static isValidYouTubeURL(url) {
        // ... (代码无变化)
    }
}

// 创建 API 单例
const api = new API();
