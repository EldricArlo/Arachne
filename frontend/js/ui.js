// frontend/js/ui.js

// UI 控制模块
class UI {
    constructor() {
        this.elements = this.initializeElements();
        this.setupEventListeners();
        this.isDownloading = false;
    }

    initializeElements() {
        return {
            urlInput: document.getElementById('url-input'),
            qualitySelect: document.getElementById('quality-select'),
            formatSelect: document.getElementById('format-select'),
            subtitleCheck: document.getElementById('subtitle-check'),
            thumbnailCheck: document.getElementById('thumbnail-check'),
            playlistCheck: document.getElementById('playlist-check'),
            audioOnlyCheck: document.getElementById('audio-only-check'),
            infoBtn: document.getElementById('info-btn'),
            downloadBtn: document.getElementById('download-btn'),
            btnText: document.getElementById('btn-text'),
            videoInfoCard: document.getElementById('video-info-card'),
            videoThumbnail: document.getElementById('video-thumbnail'),
            videoTitle: document.getElementById('video-title'),
            videoUploader: document.getElementById('video-uploader'),
            videoDuration: document.getElementById('video-duration'),
            videoViews: document.getElementById('video-views'),
            progressSection: document.getElementById('progress-section'),
            progressFill: document.getElementById('progress-fill'),
            status: document.getElementById('status'),
            progressDetails: document.getElementById('progress-details'),
            logSection: document.getElementById('log-section'),
            logContent: document.getElementById('log-content'),
            toggleLogBtn: document.getElementById('toggle-log'),
            downloadsList: document.getElementById('downloads-list'),
            container: document.querySelector('.container'), // 用于显示通知
        };
    }

    setupEventListeners() {
        this.elements.audioOnlyCheck.addEventListener('change', () => this.handleAudioOnlyChange());
        this.elements.formatSelect.addEventListener('change', () => this.handleFormatChange());
    }

    handleAudioOnlyChange() {
        const isAudioOnly = this.elements.audioOnlyCheck.checked;
        this.elements.qualitySelect.disabled = isAudioOnly;
        // 如果勾选了“仅音频”，自动切换到支持的音频格式
        if (isAudioOnly) {
            const currentFormat = this.elements.formatSelect.value;
            if (!['mp3', 'wav'].includes(currentFormat)) {
                this.elements.formatSelect.value = 'mp3';
            }
        }
    }
    
    handleFormatChange() {
        const selectedFormat = this.elements.formatSelect.value;
        if (['mp3', 'wav'].includes(selectedFormat)) {
            this.elements.audioOnlyCheck.checked = true;
            this.handleAudioOnlyChange();
        } else {
            this.elements.audioOnlyCheck.checked = false;
            this.handleAudioOnlyChange();
        }
    }

    addLog(message, type = 'info') {
        const logEntry = document.createElement('div');
        logEntry.textContent = `[${new Date().toLocaleTimeString()}] [${type.toUpperCase()}] ${message}`;
        logEntry.style.color = type === 'error' ? '#ff6b6b' : (type === 'success' ? '#6ab04c' : '#00ff00');
        this.elements.logContent.appendChild(logEntry);
        this.elements.logContent.scrollTop = this.elements.logContent.scrollHeight;
    }

    clearLog() {
        this.elements.logContent.innerHTML = '';
        this.addLog('日志已清空');
    }

    toggleLog() {
        const isHidden = this.elements.logSection.style.display === 'none';
        this.elements.logSection.style.display = isHidden ? 'block' : 'none';
        this.elements.toggleLogBtn.textContent = isHidden ? '隐藏日志' : '显示日志';
    }

    validateInput() {
        const url = this.getInputURL();
        if (!url) {
            this.showNotification('请输入视频链接', 'error');
            return false;
        }
        if (!API.isValidYouTubeURL(url)) {
            this.showNotification('请输入有效的 YouTube 链接', 'error');
            return false;
        }
        return true;
    }

    getInputURL() {
        return this.elements.urlInput.value.trim();
    }
    
    getDownloadOptions() {
        return {
            quality: this.elements.qualitySelect.value,
            format: this.elements.formatSelect.value,
            subtitle: this.elements.subtitleCheck.checked,
            thumbnail: this.elements.thumbnailCheck.checked,
            playlist: this.elements.playlistCheck.checked,
            audioOnly: this.elements.audioOnlyCheck.checked,
        };
    }

    showVideoInfo(info) {
        this.elements.videoThumbnail.src = info.thumbnail || '';
        this.elements.videoTitle.textContent = info.title || '未知标题';
        this.elements.videoUploader.textContent = info.uploader || '未知上传者';
        this.elements.videoDuration.textContent = API.formatDuration(info.duration);
        this.elements.videoViews.textContent = API.formatNumber(info.view_count) + ' 次观看';
        this.elements.videoInfoCard.style.display = 'flex';
    }

    hideVideoInfo() {
        this.elements.videoInfoCard.style.display = 'none';
    }
    
    setDownloadingState(isDownloading) {
        this.isDownloading = isDownloading;
        this.elements.downloadBtn.disabled = isDownloading;
        this.elements.infoBtn.disabled = isDownloading;

        if (isDownloading) {
            this.elements.progressSection.style.display = 'block';
            this.updateProgress(0, '准备下载...');
            this.elements.btnText.textContent = '下载中...';
            this.elements.downloadBtn.parentElement.classList.add('downloading');
        } else {
            this.elements.btnText.textContent = '🚀 开始下载';
            this.elements.downloadBtn.parentElement.classList.remove('downloading');
        }
    }

    setDownloadSuccessState() {
        this.setDownloadingState(false);
        this.elements.downloadBtn.classList.add('success');
        this.elements.btnText.textContent = '下载完成!';
        setTimeout(() => {
            this.elements.downloadBtn.classList.remove('success');
            this.elements.btnText.textContent = '🚀 开始下载';
        }, 3000);
    }

    setDownloadErrorState(errorMsg) {
        this.setDownloadingState(false);
        this.elements.downloadBtn.classList.add('error');
        this.elements.btnText.textContent = '下载失败';
        this.updateProgress(100, `错误: ${errorMsg}`);
        this.elements.progressFill.style.backgroundColor = '#e74c3c';
        setTimeout(() => {
            this.elements.downloadBtn.classList.remove('error');
            this.elements.btnText.textContent = '🚀 开始下载';
        }, 5000);
    }

    updateProgress(percent, statusText, details = null) {
        this.elements.progressFill.style.width = `${percent}%`;
        this.elements.status.textContent = statusText;

        if (details) {
            const speed = API.formatFileSize(details.speed || 0) + '/s';
            const eta = new Date((details.eta || 0) * 1000).toISOString().substr(14, 5);
            this.elements.progressDetails.textContent = `速度: ${speed} | 预计剩余时间: ${eta}`;
        } else {
            this.elements.progressDetails.textContent = '';
        }
    }

    async loadDownloadHistory() {
        try {
            const response = await api.getDownloads();
            this.elements.downloadsList.innerHTML = ''; // Clear existing list
            if (response.files && response.files.length > 0) {
                response.files.forEach(file => {
                    const item = document.createElement('div');
                    item.className = 'download-item';
                    item.innerHTML = `
                        <div class="download-info">
                            <div class="name">${file.name}</div>
                            <div class="details">
                                <span>${API.formatFileSize(file.size)}</span> | 
                                <span>${new Date(file.created * 1000).toLocaleString()}</span>
                            </div>
                        </div>
                        <div class="download-actions">
                            <button class="open-btn">打开</button>
                            <button class="delete-btn">删除</button>
                        </div>
                    `;
                    item.querySelector('.open-btn').addEventListener('click', () => this.openFile(file.path));
                    item.querySelector('.delete-btn').addEventListener('click', () => this.deleteFile(file.name));
                    this.elements.downloadsList.appendChild(item);
                });
            } else {
                this.elements.downloadsList.innerHTML = '<p>还没有下载记录。</p>';
            }
        } catch (error) {
            this.addLog('加载下载历史失败: ' + error.message, 'error');
        }
    }

    async deleteFile(filename) {
        const confirmed = await window.electronAPI.showConfirmDialog(
            `确定要删除文件 "${filename}" 吗？`
        );
        if (confirmed) {
            try {
                await api.deleteFile(filename);
                this.showNotification('文件已删除', 'success');
                this.loadDownloadHistory();
            } catch (error) {
                this.showNotification(`删除失败: ${error.message}`, 'error');
            }
        }
    }

    openFile(filePath) {
        window.electronAPI.openPath(filePath);
    }
    
    openDownloadsFolder() {
        window.electronAPI.openDownloadsFolder();
    }
    
    showNotification(message, type = 'info', duration = 3000) {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;

        // 添加一些基本样式
        notification.style.position = 'fixed';
        notification.style.top = '20px';
        notification.style.right = '20px';
        notification.style.padding = '15px 25px';
        notification.style.borderRadius = '8px';
        notification.style.color = 'white';
        notification.style.zIndex = '1000';
        notification.style.boxShadow = '0 5px 15px rgba(0,0,0,0.2)';
        notification.style.opacity = '0';
        notification.style.transition = 'opacity 0.5s, transform 0.5s';
        notification.style.transform = 'translateX(100%)';
        notification.style.backgroundColor = type === 'error' ? '#e74c3c' : (type === 'success' ? '#2ecc71' : '#3498db');

        document.body.appendChild(notification);
        
        // 动画
        setTimeout(() => {
            notification.style.opacity = '1';
            notification.style.transform = 'translateX(0)';
        }, 10);
        
        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 500);
        }, duration);
    }
}

const ui = new UI();