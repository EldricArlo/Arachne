// frontend/js/main.js

class App {
    constructor() {
        this.progressInterval = null;
        // 注意：初始化现在是一个异步过程，在 init() 中处理
    }

    async init() {
        // 关键：首先异步初始化 API 模块以获取正确的端口
        await api.init();
        
        ui.addLog('应用程序启动');
        await this.checkBackendStatus();
        await ui.loadDownloadHistory();
        ui.addLog('初始化完成');
    }

    // 检查后端服务状态
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
            ui.showNotification('无法连接到后端服务，请确保Python服务已启动', 'error', 5000);
        }
    }

    // 获取视频信息
    async getVideoInfo() {
        if (!ui.validateInput()) {
            return;
        }

        const url = ui.getInputURL();
        
        try {
            // 设置加载状态
            ui.elements.infoBtn.disabled = true;
            ui.elements.infoBtn.textContent = '⏳';
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
            ui.showNotification('获取视频信息失败: ' + error.message, 'error');
            ui.hideVideoInfo();
        } finally {
            // 恢复按钮状态
            ui.elements.infoBtn.disabled = false;
            ui.elements.infoBtn.textContent = '📋';
        }
    }

    // 开始下载
    async startDownload() {
        if (ui.isDownloading) {
            ui.showNotification('下载正在进行中', 'warning');
            return;
        }

        if (!ui.validateInput()) {
            return;
        }

        const url = ui.getInputURL();
        const options = ui.getDownloadOptions();

        try {
            ui.addLog('开始下载: ' + url);
            ui.addLog('下载选项: ' + JSON.stringify(options, null, 2));
            
            // 设置下载状态
            ui.setDownloadingState(true);

            // 开始下载
            const response = await api.startDownload(url, options);
            
            if (response.success) {
                ui.addLog('下载任务已创建，任务ID: ' + response.task_id);
                
                // 开始监控进度
                this.startProgressMonitoring(response.task_id);
            } else {
                throw new Error(response.error || '启动下载失败');
            }
        } catch (error) {
            ui.addLog('下载启动失败: ' + error.message, 'error');
            ui.setDownloadErrorState(error.message);
        }
    }

    // 开始进度监控
    startProgressMonitoring(taskId) {
        if (this.progressInterval) {
            clearInterval(this.progressInterval);
        }

        this.progressInterval = setInterval(async () => {
            try {
                const progress = await api.getProgress(taskId);
                this.handleProgressUpdate(progress);
            } catch (error) {
                ui.addLog('获取进度失败: ' + error.message, 'error');
                this.stopProgressMonitoring();
                ui.setDownloadErrorState('进度监控失败');
            }
        }, 1000);
    }

    // 停止进度监控
    stopProgressMonitoring() {
        if (this.progressInterval) {
            clearInterval(this.progressInterval);
            this.progressInterval = null;
        }
    }

    // 处理进度更新
    handleProgressUpdate(progress) {
        switch (progress.status) {
            case 'info_extracted':
                ui.addLog('视频信息提取完成: ' + progress.title);
                ui.updateProgress(5, '信息提取完成');
                break;

            case 'downloading':
                const percent = Math.round(progress.percent || 0);
                ui.updateProgress(percent, '正在下载...', {
                    speed: progress.speed,
                    downloaded: progress.downloaded,
                    total: progress.total,
                    eta: progress.eta
                });
                ui.addLog(`下载进度: ${percent}%`);
                break;

            case 'finished':
                ui.addLog('下载完成: ' + progress.filename);
                ui.updateProgress(90, '正在处理文件...');
                break;

            case 'completed':
                this.stopProgressMonitoring();
                ui.updateProgress(100, '下载完成！');
                ui.setDownloadSuccessState();
                ui.addLog('任务完成！');
                ui.showNotification('下载完成！', 'success');
                
                // 刷新下载历史
                setTimeout(() => {
                    ui.loadDownloadHistory();
                }, 1000);

                // 清除任务ID
                api.clearCurrentTaskId();
                break;

            case 'error':
                this.stopProgressMonitoring();
                const error = progress.error || progress.result?.error || '未知错误';
                ui.addLog('下载失败: ' + error, 'error');
                ui.setDownloadErrorState(error);
                api.clearCurrentTaskId();
                break;

            default:
                ui.addLog('状态更新: ' + progress.status);
        }
    }

    // 切换日志显示
    toggleLog() {
        ui.toggleLog();
    }

    // 清空日志
    clearLog() {
        ui.clearLog();
    }

    // 打开下载文件夹
    openDownloadsFolder() {
        ui.openDownloadsFolder();
    }

    // 应用关闭时的清理
    cleanup() {
        this.stopProgressMonitoring();
        ui.addLog('应用程序关闭');
    }
}

// 全局函数（供HTML调用）
let app;

// 应用初始化
document.addEventListener('DOMContentLoaded', async () => {
    app = new App();
    await app.init(); // 等待异步初始化完成
});

// 页面卸载时清理
window.addEventListener('beforeunload', () => {
    if (app) {
        app.cleanup();
    }
});

// 导出的全局函数
function getVideoInfo() {
    app.getVideoInfo();
}

function startDownload() {
    app.startDownload();
}

function toggleLog() {
    app.toggleLog();
}

function clearLog() {
    app.clearLog();
}

function openDownloadsFolder() {
    app.openDownloadsFolder();
}

// 错误处理
window.addEventListener('error', (event) => {
    console.error('全局错误:', event.error);
    if (ui) {
        ui.addLog('应用错误: ' + event.error.message, 'error');
        ui.showNotification('应用发生错误，请查看日志', 'error');
    }
});

// 未处理的Promise拒绝
window.addEventListener('unhandledrejection', (event) => {
    console.error('未处理的Promise拒绝:', event.reason);
    if (ui) {
        ui.addLog('Promise错误: ' + event.reason, 'error');
    }
    event.preventDefault();
});