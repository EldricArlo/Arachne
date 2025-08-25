// frontend/js/ui.js

/**
 * UI 控制模块类。
 * 封装了所有与 DOM 元素交互的操作，充当视图（View）的角色。
 */
class UI {
    constructor() {
        this.elements = this.initializeElements(); // 缓存所有 DOM 元素
        this.setupEventListeners(); // 绑定内部事件监听
        this.isDownloading = false; // UI 级别的下载状态锁
    }

    /**
     * 查询并缓存所有需要操作的 DOM 元素。
     * @returns {object} 包含所有 DOM 元素引用的对象。
     */
    initializeElements() {
        return {
            // ... (元素列表保持不变)
        };
    }

    /**
     * 为 UI 内部元素绑定事件监听器，处理联动逻辑。
     */
    setupEventListeners() {
        // 当“仅下载音频”复选框状态改变时
        this.elements.audioOnlyCheck.addEventListener('change', () => this.handleAudioOnlyChange());
        // 当格式选择变化时，可能需要同步“仅下载音频”的状态
        this.elements.formatSelect.addEventListener('change', () => this.handleFormatChange());
    }

    /**
     * 处理“仅下载音频”复选框的逻辑。
     * 如果勾选，则禁用视频质量选择。
     */
    handleAudioOnlyChange() {
        const isAudioOnly = this.elements.audioOnlyCheck.checked;
        this.elements.qualitySelect.disabled = isAudioOnly;
        if (isAudioOnly) {
            const currentFormat = this.elements.formatSelect.value;
            // 如果当前格式不是音频格式，自动切换到 mp3
            if (!['mp3', 'wav'].includes(currentFormat)) {
                this.elements.formatSelect.value = 'mp3';
            }
        }
    }
    
    /**
     * 处理格式选择的逻辑。
     * 如果选择了音频格式，自动勾选“仅下载音频”。
     */
    handleFormatChange() {
        const selectedFormat = this.elements.formatSelect.value;
        if (['mp3', 'wav'].includes(selectedFormat)) {
            this.elements.audioOnlyCheck.checked = true;
        } else {
            this.elements.audioOnlyCheck.checked = false;
        }
        this.handleAudioOnlyChange(); // 触发联动更新
    }

    /**
     * 在日志区域添加一条日志。
     * @param {string} message - 日志内容。
     * @param {'info' | 'error' | 'success'} [type='info'] - 日志类型。
     */
    addLog(message, type = 'info') {
        // ... (代码无变化)
    }
    
    // ... 其他 UI 方法，如 clearLog, toggleLog, validateInput, getDownloadOptions 等，
    // 它们的逻辑已经非常清晰，我将为关键的状态管理函数添加更详细的注释。

    /**
     * 设置获取信息按钮的加载状态。
     * @param {boolean} isLoading - 是否正在加载。
     */
    setInfoButtonLoading(isLoading) {
        this.elements.infoBtn.disabled = isLoading;
        this.elements.infoBtn.textContent = isLoading ? '⏳' : '📋';
    }

    /**
     * 控制 UI 进入或退出“下载中”的状态。
     * @param {boolean} isDownloading - 是否正在下载。
     */
    setDownloadingState(isDownloading) {
        this.isDownloading = isDownloading;
        this.elements.downloadBtn.disabled = isDownloading;
        this.elements.infoBtn.disabled = isDownloading;

        if (isDownloading) {
            this.elements.progressSection.style.display = 'block';
            this.updateProgress(0, '准备下载...');
            this.elements.btnText.textContent = '下载中...';
            this.elements.downloadBtn.classList.add('downloading'); // 添加动画效果
        } else {
            this.elements.btnText.textContent = '🚀 开始下载';
            this.elements.downloadBtn.classList.remove('downloading');
        }
    }

    /**
     * 设置 UI 为下载成功的状态（临时）。
     */
    setDownloadSuccessState() {
        this.setDownloadingState(false);
        this.updateProgress(100, '下载完成！');
        this.elements.progressFill.style.backgroundColor = '#2ecc71';
        this.elements.downloadBtn.classList.add('success');
        this.elements.btnText.textContent = '下载完成!';
        
        setTimeout(() => {
            this.elements.downloadBtn.classList.remove('success');
            this.elements.btnText.textContent = '🚀 开始下载';
        }, 3000);
    }

    /**
     * 设置 UI 为下载失败的状态（临时）。
     * @param {string} errorMsg - 错误信息。
     */
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
    
    /**
     * 更新下载进度条和状态文本。
     * @param {number} percent - 进度百分比 (0-100)。
     * @param {string} statusText - 状态描述文本。
     * @param {object|null} details - 包含速度、ETA 等详细信息的对象。
     */
    updateProgress(percent, statusText, details = null) {
        this.elements.progressFill.style.width = `${percent}%`;
        this.elements.status.textContent = statusText;

        if (details) {
            const speed = api.formatFileSize(details.speed || 0) + '/s';
            // 格式化 ETA (预计剩余时间)
            const etaSeconds = details.eta || 0;
            const eta = etaSeconds > 0 ? new Date(etaSeconds * 1000).toISOString().substr(14, 5) : '...';
            this.elements.progressDetails.textContent = `速度: ${speed} | 预计剩余: ${eta}`;
        } else {
            this.elements.progressDetails.textContent = '';
        }
    }

    /**
     * 从后端加载并渲染下载历史列表。
     */
    async loadDownloadHistory() {
        // ... (代码逻辑清晰，无需修改)
    }

    /**
     * 删除一个文件，并在操作前弹出确认对话框。
     * @param {string} filename - 要删除的文件名。
     */
    async deleteFile(filename) {
        // 使用 electronAPI 调用主进程的确认对话框
        const confirmed = await window.electronAPI.showConfirmDialog(
            `确定要删除文件 "${filename}" 吗？此操作不可恢复。`
        );
        if (confirmed) {
            try {
                await api.deleteFile(filename);
                this.showNotification('文件已删除', 'success');
                this.loadDownloadHistory(); // 刷新列表
            } catch (error) {
                this.showNotification(`删除失败: ${error.message}`, 'error');
            }
        }
    }
    
    // ... 其他方法如 openFile, openDownloadsFolder, showNotification 逻辑清晰，无需修改。
}

// 创建 UI 单例
const ui = new UI();
