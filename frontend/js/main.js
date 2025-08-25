// frontend/js/main.js

/**
 * 主应用程序类，负责业务逻辑和状态管理。
 * 它是连接 UI 操作和后端 API 的核心。
 */
class App {
    constructor() {
        this.progressInterval = null; // 用于轮询下载进度的定时器 ID
    }

    /**
     * 异步初始化应用程序。
     * 这是应用启动的入口点。
     */
    async init() {
        // 关键：首先等待 API 模块完成初始化（即成功获取后端端口）
        await api.initializationPromise;
        
        ui.addLog('应用程序启动');
        await this.checkBackendStatus();
        await ui.loadDownloadHistory();
        ui.addLog('初始化完成');
    }

    /**
     * 检查后端服务的连接状态。
     */
    async checkBackendStatus() {
        try {
            const isOnline = await api.checkStatus();
            if (isOnline) {
                ui.addLog('后端服务连接成功');
                ui.showNotification('服务已就绪', 'success');
            } else {
                throw new Error('无法连接到后端服务');
            }
        } catch (error) {
            ui.addLog('后端服务连接失败: ' + error.message, 'error');
            ui.showNotification('无法连接后端服务，请重启应用', 'error', 5000);
        }
    }

    /**
     * 获取并显示视频信息。
     */
    async getVideoInfo() {
        if (!ui.validateInput()) return;

        const url = ui.getInputURL();
        
        try {
            ui.setInfoButtonLoading(true); // 设置 UI 为加载状态
            ui.addLog('正在获取视频信息...');
            const response = await api.getVideoInfo(url);
            
            if (response.success) {
                ui.showVideoInfo(response.info);
                ui.addLog('视频信息获取成功');
                ui.showNotification('视频信息已加载', 'success');
            } else {
                throw new Error(response.error || '获取视频信息失败');
            }
        } catch (error) {
            ui.addLog('获取视频信息失败: ' + error.message, 'error');
            ui.showNotification('获取信息失败: ' + error.message, 'error');
            ui.hideVideoInfo();
        } finally {
            ui.setInfoButtonLoading(false); // 恢复 UI 状态
        }
    }

    /**
     * 启动下载流程。
     */
    async startDownload() {
        if (ui.isDownloading) {
            ui.showNotification('已有任务正在下载中', 'warning');
            return;
        }
        if (!ui.validateInput()) return;

        const url = ui.getInputURL();
        const options = ui.getDownloadOptions();

        try {
            ui.addLog('准备开始下载: ' + url);
            ui.addLog('下载选项: ' + JSON.stringify(options, null, 2));
            ui.setDownloadingState(true); // 将 UI 切换到“下载中”状态

            const response = await api.startDownload(url, options);
            
            if (response.success) {
                ui.addLog('下载任务已创建，任务ID: ' + response.task_id);
                this.startProgressMonitoring(response.task_id); // 开始轮询进度
            } else {
                throw new Error(response.error || '启动下载失败');
            }
        } catch (error) {
            ui.addLog('下载启动失败: ' + error.message, 'error');
            ui.setDownloadErrorState(error.message);
        }
    }

    /**
     * 开始轮询指定任务的下载进度。
     * @param {string} taskId - 要监控的任务 ID。
     */
    startProgressMonitoring(taskId) {
        this.stopProgressMonitoring(); // 先确保没有其他定时器在运行

        this.progressInterval = setInterval(async () => {
            try {
                const progress = await api.getProgress(taskId);
                this.handleProgressUpdate(progress);
            } catch (error) {
                ui.addLog('获取进度失败: ' + error.message, 'error');
                this.stopProgressMonitoring();
                ui.setDownloadErrorState('进度监控失败');
            }
        }, 1000); // 每秒查询一次
    }

    /**
     * 停止进度轮询。
     */
    stopProgressMonitoring() {
        if (this.progressInterval) {
            clearInterval(this.progressInterval);
            this.progressInterval = null;
        }
    }

    /**
     * 根据从后端获取的进度信息更新 UI。
     * 这是一个状态机，根据不同的 status 更新界面。
     * @param {object} progress - 包含任务状态和数据的对象。
     */
    handleProgressUpdate(progress) {
        switch (progress.status) {
            case 'downloading':
                const percent = Math.round(progress.percent || 0);
                ui.updateProgress(percent, '正在下载...', progress);
                break;
            case 'finished':
                ui.addLog('文件下载完成，正在后期处理 (如合并音视频)...');
                ui.updateProgress(95, '正在处理文件...'); // 给用户一个处理中的反馈
                break;
            case 'completed':
                this.stopProgressMonitoring();
                ui.addLog('任务完成！');
                ui.setDownloadSuccessState();
                ui.showNotification('下载完成！', 'success');
                setTimeout(() => ui.loadDownloadHistory(), 1000); // 延迟刷新历史记录
                api.clearCurrentTaskId();
                break;
            case 'error':
                this.stopProgressMonitoring();
                const error = progress.error || '未知错误';
                ui.addLog('下载失败: ' + error, 'error');
                ui.setDownloadErrorState(error);
                api.clearCurrentTaskId();
                break;
            case 'queued':
                ui.updateProgress(0, '任务已排队...');
                break;
        }
    }
    
    /**
     * 在应用关闭前进行清理。
     */
    cleanup() {
        this.stopProgressMonitoring();
        ui.addLog('应用程序关闭');
    }
}

// --- 全局作用域 ---

let app;

// DOM 加载完成后，初始化 App 实例
document.addEventListener('DOMContentLoaded', async () => {
    app = new App();
    await app.init();
});

// 页面卸载（关闭）时，执行清理
window.addEventListener('beforeunload', () => {
    app?.cleanup();
});

// --- 暴露给 HTML onclick 的全局函数 ---
// 这是将 HTML 事件连接到 App 类方法的简单方式

function getVideoInfo() { app.getVideoInfo(); }
function startDownload() { app.startDownload(); }
function toggleLog() { ui.toggleLog(); }
function clearLog() { ui.clearLog(); }
function openDownloadsFolder() { ui.openDownloadsFolder(); }
