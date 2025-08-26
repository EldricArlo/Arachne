// frontend/js/ui.js

/**
 * UI Controller Module Class.
 * 
 * Manages all direct DOM manipulations and UI state changes. It should not contain
 * any core business logic but should instead be called by app.js to reflect
 * changes in the application's state.
 */
class UI {
    constructor() {
        this.elements = this.initializeElements();
        this.setupEventListeners();
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

            // Download Options
            optionsSection: document.getElementById('options-section'),

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
            browseFolderBtn: document.getElementById('browse-folder-btn'),
        };
    }

    /**
     * Binds all application event listeners.
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
        this.elements.browseFolderBtn.addEventListener('click', () => window.selectDownloadsFolder());

        // Internal UI logic listeners
        this.elements.settingProxyEnabled.addEventListener('change', (e) => {
            this.elements.settingProxyUrl.disabled = !e.target.checked;
        });
        this.elements.settingSaveThumbnail.addEventListener('change', (e) => {
            this.elements.settingEmbedThumbnail.disabled = !e.target.checked;
            if (!e.target.checked) {
                this.elements.settingEmbedThumbnail.checked = false;
            }
        });
    }

    /**
     * 新增一个方法，用于从 main.js 更新下载目录输入框的值
     * @param {string} path - 新的文件夹路径
     */
    updateDownloadsDirInput(path) {
        if (path) {
            this.elements.settingDownloadsDir.value = path;
        }
    }

    // --- UI State Management ---

    setLoadingState(button, isLoading, originalText = 'Get Info') {
        if (isLoading) {
            button.disabled = true;
            const textElement = button.querySelector('span') || button;
            textElement.innerHTML = '<span class="spinner"></span> Working...';
        } else {
            button.disabled = false;
            const textElement = button.querySelector('span') || button;
            textElement.textContent = originalText;
        }
    }

    toggleUIState(isDownloading) {
        this.isDownloading = isDownloading;
        this.elements.urlInput.disabled = isDownloading;
        this.elements.infoBtn.disabled = isDownloading;
        // The download button's state is managed separately based on whether info is available.
    }

    resetUI() {
        this.toggleUIState(false);
        this.elements.videoInfoCard.style.display = 'none';
        this.elements.optionsSection.style.display = 'none';
        this.elements.optionsSection.innerHTML = '';
        this.elements.progressSection.style.display = 'none';
        this.elements.downloadBtn.disabled = true;
        this.elements.btnText.textContent = '🚀 Start Download';
    }

    // --- Core UI Display Logic ---

    displayVideoInfo(info) {
        this.elements.videoThumbnail.src = info.thumbnail || '';
        this.elements.videoTitle.textContent = info.title;
        this.elements.videoUploader.textContent = `Uploader: ${info.uploader}`;
        this.elements.videoDuration.textContent = API.formatDuration(info.duration);
        this.elements.videoViews.textContent = `${API.formatNumber(info.view_count)} views`;
        this.elements.videoInfoCard.style.display = 'flex';

        this.displayDownloadOptions(); // After displaying info, show the options
        this.elements.downloadBtn.disabled = false; // Enable the download button
    }

    displayDownloadOptions() {
        this.elements.optionsSection.innerHTML = `
            <div class="options-grid">
                <div class="option-item">
                    <label for="quality-select">Quality</label>
                    <select id="quality-select">
                        <option value="best">Best Available</option>
                        <option value="4K">4K (2160p)</option>
                        <option value="1080p" selected>Full HD (1080p)</option>
                        <option value="720p">HD (720p)</option>
                        <option value="worst">Worst Available</option>
                    </select>
                </div>
                <div class="option-item">
                    <label for="format-select">Format</label>
                    <select id="format-select">
                        <option value="mp4" selected>MP4</option>
                        <option value="webm">WebM</option>
                        <option value="mkv">MKV</option>
                    </select>
                </div>
                <div class="option-item checkbox-item">
                     <input type="checkbox" id="audio-only-checkbox">
                     <label for="audio-only-checkbox">Audio Only</label>
                </div>
            </div>
        `;

        const audioOnlyCheckbox = document.getElementById('audio-only-checkbox');
        const formatSelect = document.getElementById('format-select');

        audioOnlyCheckbox.addEventListener('change', (e) => {
            if (e.target.checked) {
                formatSelect.innerHTML = `
                    <option value="mp3" selected>MP3</option>
                    <option value="m4a">M4A</option>
                    <option value="wav">WAV</option>
                    <option value="opus">Opus</option>
                `;
            } else {
                formatSelect.innerHTML = `
                    <option value="mp4" selected>MP4</option>
                    <option value="webm">WebM</option>
                    <option value="mkv">MKV</option>
                `;
            }
        });

        this.elements.optionsSection.style.display = 'block';
    }

    collectDownloadOptions() {
        const quality = document.getElementById('quality-select')?.value;
        const format = document.getElementById('format-select')?.value;
        const audioOnly = document.getElementById('audio-only-checkbox')?.checked;
        return { quality, format, audioOnly };
    }

    updateProgress(progress) {
        if (this.elements.progressSection.style.display === 'none') {
            this.elements.progressSection.style.display = 'block';
        }

        this.elements.status.textContent = progress.status.charAt(0).toUpperCase() + progress.status.slice(1) + '...';

        if (progress.status === 'downloading') {
            const percent = progress.percent || 0;
            this.elements.progressFill.style.width = `${percent}%`;

            const downloaded = API.formatFileSize(progress.downloaded || 0);
            const total = API.formatFileSize(progress.total || 0);
            const speed = progress.speed ? `${API.formatFileSize(progress.speed)}/s` : '...';
            const eta = progress.eta ? `${API.formatDuration(progress.eta)}` : '...';

            this.elements.progressDetails.textContent = `[ ${downloaded} / ${total} ] @ ${speed} | ETA: ${eta}`;
        } else if (progress.status === 'processing') {
            this.elements.progressFill.style.width = `100%`;
            this.elements.progressDetails.textContent = progress.message || 'Finalizing file...';
        } else if (progress.status === 'completed') {
            this.elements.status.textContent = 'Download Completed!';
            this.elements.progressFill.style.width = '100%';
            this.elements.progressDetails.textContent = 'Done.';
        } else if (progress.status === 'error') {
            this.elements.status.textContent = 'Error!';
            this.elements.progressFill.style.width = '100%';
            this.elements.progressFill.style.backgroundColor = 'var(--error-color)';
            this.elements.progressDetails.textContent = `Error: ${progress.error}`;
        }
    }

    // --- IPC Communication with Main Process ---

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
            this.addLog('Loading download history...');
            const data = await api.getDownloads();
            this.elements.downloadsList.innerHTML = '';

            if (!data.files || data.files.length === 0) {
                this.elements.downloadsList.innerHTML = '<p class="empty-history">There are no download records yet.</p>';
                return;
            }

            data.files.forEach(file => {
                const item = this.createDownloadItem(file);
                this.elements.downloadsList.appendChild(item);
            });
            this.addLog('Download history loaded successfully.');
        } catch (error) {
            this.addLog(`Failed to load download history: ${error.message}`, 'error');
            this.showNotification(`Failed to load history: ${error.message}`, 'error');
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
        this.elements.settingEmbedThumbnail.disabled = !config.save_thumbnail;
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
            window.app.saveConfig(newConfig);
        }
        this.toggleSettingsModal(false);
    }

    // --- Logging and Notifications ---

    addLog(message, type = 'info') {
        const logEntry = document.createElement('div');
        const timestamp = `[${new Date().toLocaleTimeString()}]`;
        logEntry.textContent = `${timestamp} ${message}`;
        logEntry.className = `log-entry log-${type}`;
        this.elements.logContent.appendChild(logEntry);
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
        // A real implementation would create a toast element.
        // For now, we'll just log it clearly.
        console.log(`[Notification-${type}]: ${message}`);
        this.addLog(`[Notification] ${message}`, type);
    }

    showError(error) {
        const errorMessage = error.message || 'An unknown error occurred.';
        this.addLog(errorMessage, 'error');
        this.showNotification(errorMessage, 'error', 5000);
    }
}

// Create and export a UI singleton for app.js to use.
const ui = new UI();