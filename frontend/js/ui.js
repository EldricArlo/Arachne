// frontend/js/ui.js

/**
 * UI Controller Module Class.
 */
class UI {
    constructor() {
        this.elements = this.initializeElements();
        this.setupEventListeners(); // This will now handle all event bindings
        this.isDownloading = false;
    }

    initializeElements() {
        return {
            // Main page elements
            urlInput: document.getElementById('url-input'),
            infoBtn: document.getElementById('info-btn'),
            downloadBtn: document.getElementById('download-btn'),
            btnText: document.getElementById('btn-text'),
            settingsBtn: document.getElementById('settings-btn'),

            // Progress and Log sections
            progressSection: document.getElementById('progress-section'),
            progressFill: document.getElementById('progress-fill'),
            status: document.getElementById('status'),
            progressDetails: document.getElementById('progress-details'),
            logContent: document.getElementById('log-content'),
            logSection: document.getElementById('log-section'),
            toggleLogBtn: document.getElementById('toggle-log-btn'),
            clearLogBtn: document.getElementById('clear-log-btn'),
            openFolderBtn: document.getElementById('open-folder-btn'),
            
            // Video Info Card
            videoInfoCard: document.getElementById('video-info-card'),
            videoThumbnail: document.getElementById('video-thumbnail'),
            videoTitle: document.getElementById('video-title'),
            videoUploader: document.getElementById('video-uploader'),
            videoDuration: document.getElementById('video-duration'),
            videoViews: document.getElementById('video-views'),
            
            // Download History
            downloadsList: document.getElementById('downloads-list'),
            
            // Settings Modal
            settingsModal: document.getElementById('settings-modal'),
            settingsCloseBtn: document.getElementById('settings-close-btn'),
            settingsSaveBtn: document.getElementById('settings-save-btn'),
            settingsCancelBtn: document.getElementById('settings-cancel-btn'),
            settingDownloadsDir: document.getElementById('setting-downloads-dir'),
            settingMaxConcurrent: document.getElementById('setting-max-concurrent'),
            settingProxyEnabled: document.getElementById('setting-proxy-enabled'),
            settingProxyUrl: document.getElementById('setting-proxy-url'),
            settingUseAria2: document.getElementById('setting-use-aria2'),
            settingLimitRate: document.getElementById('setting-limit-rate'),
            settingSaveThumbnail: document.getElementById('setting-save-thumbnail'),
            settingEmbedThumbnail: document.getElementById('setting-embed-thumbnail'),
            settingEmbedChapters: document.getElementById('setting-embed-chapters'),
            settingEmbedSubtitles: document.getElementById('setting-embed-subtitles'),
        };
    }

    /**
     * Binds all application event listeners.
     * This is the modern, CSP-compliant way to handle events.
     */
    setupEventListeners() {
        // Main page actions
        this.elements.infoBtn.addEventListener('click', () => window.getVideoInfo());
        this.elements.downloadBtn.addEventListener('click', () => window.startDownload());
        this.elements.toggleLogBtn.addEventListener('click', () => this.toggleLog());
        this.elements.clearLogBtn.addEventListener('click', () => this.clearLog());
        this.elements.openFolderBtn.addEventListener('click', () => window.openDownloadsFolder());
        
        // Settings modal controls
        this.elements.settingsBtn.addEventListener('click', () => this.toggleSettingsModal(true));
        this.elements.settingsCloseBtn.addEventListener('click', () => this.toggleSettingsModal(false));
        this.elements.settingsCancelBtn.addEventListener('click', () => this.toggleSettingsModal(false));
        this.elements.settingsSaveBtn.addEventListener('click', () => this.saveSettings());

        // Internal UI logic listeners
        this.elements.settingProxyEnabled.addEventListener('change', (e) => {
            this.elements.settingProxyUrl.disabled = !e.target.checked;
        });
        this.elements.settingSaveThumbnail.addEventListener('change', (e) => {
            if (!e.target.checked) {
                this.elements.settingEmbedThumbnail.checked = false;
            }
            this.elements.settingEmbedThumbnail.disabled = !e.target.checked;
        });
    }
    
    // --- IPC Communication with Main Process ---

    async openDownloadsFolder() {
        if (window.app && window.app.config) {
            const downloadsDir = window.app.config.downloads_dir;
            this.addLog(`Requesting to open downloads folder: ${downloadsDir}`);
            await window.electronAPI.openDownloadsFolder(downloadsDir);
        } else {
            this.addLog('Cannot open downloads folder: application config not loaded.', 'error');
            this.showNotification('Configuration not yet loaded, cannot open folder', 'error');
        }
    }
    
    async openFile(filePath) {
        if (window.app && window.app.config) {
            const downloadsPath = window.app.config.downloads_dir;
            this.addLog(`Requesting to open file: ${filePath}`);
            await window.electronAPI.openPath({ filePath, downloadsPath });
        } else {
            this.addLog('Cannot open file: application config not loaded.', 'error');
        }
    }
    
    // --- Download History ---

    async loadDownloadHistory() {
        try {
            const data = await api.getDownloads();
            this.elements.downloadsList.innerHTML = ''; // Clear previous items

            if (!data.files || data.files.length === 0) {
                this.elements.downloadsList.innerHTML = '<p class="empty-history">There are no download records yet.</p>';
                return;
            }
            
            data.files.forEach(file => {
                const item = this.createDownloadItem(file);
                this.elements.downloadsList.appendChild(item);
            });
        } catch (error) {
            this.addLog(`Failed to load download history: ${error.message}`, 'error');
        }
    }

    createDownloadItem(file) {
        const item = document.createElement('div');
        item.className = 'download-item';
        
        item.innerHTML = `
            <span class="file-icon">📄</span>
            <div class="file-details">
                <span class="file-name" title="Click to open file: ${file.path}">${file.name}</span>
                <span class="file-size">${API.formatFileSize(file.size)}</span>
            </div>
            <button class="delete-btn" title="Delete file">🗑️</button>
        `;

        // Securely add event listeners instead of using inline 'onclick'
        item.querySelector('.file-name').addEventListener('click', () => this.openFile(file.path));
        item.querySelector('.delete-btn').addEventListener('click', () => window.app.deleteFile(file.name));
        
        return item;
    }
    
    // --- Settings Panel ---

    toggleSettingsModal(show) {
        if (show) {
            if (window.app && window.app.config) {
                this.loadSettings(window.app.config);
            }
            this.elements.settingsModal.style.display = 'flex';
        } else {
            this.elements.settingsModal.style.display = 'none';
        }
    }

    loadSettings(config) {
        this.elements.settingDownloadsDir.value = config.downloads_dir || '';
        this.elements.settingMaxConcurrent.value = config.max_concurrent_downloads || 3;
        this.elements.settingProxyEnabled.checked = config.proxy_enabled || false;
        this.elements.settingProxyUrl.value = config.proxy_url || '';
        this.elements.settingProxyUrl.disabled = !config.proxy_enabled;
        this.elements.settingUseAria2.checked = config.use_aria2 || false;
        this.elements.settingLimitRate.value = config.limit_rate || '0';
        this.elements.settingSaveThumbnail.checked = config.save_thumbnail || false;
        this.elements.settingEmbedThumbnail.checked = config.embed_thumbnail || false;
        this.elements.settingEmbedChapters.checked = config.embed_chapters || false;
        this.elements.settingEmbedSubtitles.checked = config.embed_subtitles || false;
    }

    collectSettings() {
        return {
            downloads_dir: this.elements.settingDownloadsDir.value,
            max_concurrent_downloads: parseInt(this.elements.settingMaxConcurrent.value, 10),
            proxy_enabled: this.elements.settingProxyEnabled.checked,
            proxy_url: this.elements.settingProxyUrl.value,
            use_aria2: this.elements.settingUseAria2.checked,
            limit_rate: this.elements.settingLimitRate.value,
            save_thumbnail: this.elements.settingSaveThumbnail.checked,
            embed_thumbnail: this.elements.settingEmbedThumbnail.checked,
            embed_chapters: this.elements.settingEmbedChapters.checked,
            embed_subtitles: this.elements.settingEmbedSubtitles.checked,
        };
    }

    saveSettings() {
        const newConfig = this.collectSettings();
        if (window.app) {
            // Call the app logic to handle saving
            window.app.saveConfig(newConfig);
        }
        this.toggleSettingsModal(false);
    }
    
    // --- [FIX] Missing UI Update Methods ---
    
    addLog(message, type = 'info') {
        const logEntry = document.createElement('div');
        logEntry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
        if (type === 'error') {
            logEntry.style.color = '#f44336';
        } else if (type === 'success') {
            logEntry.style.color = '#4caf50';
        }
        this.elements.logContent.appendChild(logEntry);
        // Auto-scroll to the bottom
        this.elements.logContent.scrollTop = this.elements.logContent.scrollHeight;
    }

    clearLog() {
        this.elements.logContent.innerHTML = '';
        this.addLog('Log cleared.');
    }

    toggleLog() {
        const isVisible = this.elements.logSection.style.display !== 'none';
        this.elements.logSection.style.display = isVisible ? 'none' : 'block';
    }
    
    showNotification(message, type = 'info', duration = 3000) {
        // For simplicity, we'll just log notifications for now.
        // A more advanced implementation would create a toast-like element.
        console.log(`[Notification-${type}]: ${message}`);
        this.addLog(`[Notification] ${message}`, type);
    }
}

// Create and export a UI singleton for app.js to use.
const ui = new UI();