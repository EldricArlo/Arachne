# backend/tasks.py

import uuid
import threading
import logging
from typing import Dict, Any, Optional

# 从 .downloader 导入 YouTubeDownloader 以进行类型提示，避免循环导入
from .downloader import YouTubeDownloader 

logger = logging.getLogger(__name__)

# --- 内存中的任务存储 ---
# _tasks: 字典，用 task_id 作为键，存储每个任务的状态和进度信息。
# _tasks_lock: 线程锁，用于确保在多线程环境下对 _tasks 字典的访问是安全的。
_tasks: Dict[str, Dict[str, Any]] = {}
_tasks_lock = threading.Lock()

def get_active_downloads_count() -> int:
    """获取当前状态为 'downloading' 的任务数量。"""
    with _tasks_lock:
        return len([
            task for task in _tasks.values() 
            if task.get('status') == 'downloading'
        ])

def get_task_status(task_id: str) -> Optional[Dict[str, Any]]:
    """
    获取单个任务的当前状态。
    前端会通过 API 轮询这个函数来获取进度更新。
    """
    with _tasks_lock:
        # 使用 .get() 避免当 task_id 不存在时引发 KeyError
        return _tasks.get(task_id)

def create_download_task(url: str, user_options: Dict[str, Any], downloader: YouTubeDownloader) -> str:
    """
    创建一个新的后台下载任务。

    Args:
        url (str): 视频 URL。
        user_options (Dict[str, Any]): 用户下载选项。
        downloader (YouTubeDownloader): 下载器实例，通过依赖注入传入。

    Returns:
        str: 新创建任务的唯一 ID。
    """
    task_id = str(uuid.uuid4())
    
    # 立即将任务状态设为 'queued' 并存入任务字典
    with _tasks_lock:
        _tasks[task_id] = {'status': 'queued'}

    # 创建并启动一个新的守护线程来执行下载工作。
    # - daemon=True 确保当主程序退出时，这些线程也会被强制终止。
    thread = threading.Thread(
        target=_download_worker,
        args=(task_id, url, user_options, downloader),
        daemon=True
    )
    thread.start()
    
    logger.info(f"任务 {task_id} 已创建并排队: {url}")
    return task_id

def _update_task_progress(task_id: str, progress_data: Dict[str, Any]):
    """
    线程安全地更新任务的进度。
    这个函数会被 downloader 的回调函数调用。
    """
    with _tasks_lock:
        if task_id in _tasks:
            _tasks[task_id].update(progress_data)

def _download_worker(task_id: str, url: str, user_options: Dict[str, Any], downloader: YouTubeDownloader):
    """
    实际执行下载的工作函数，在后台线程中运行。

    Args:
        task_id (str): 当前任务的 ID。
        url (str): 视频 URL。
        user_options (Dict[str, Any]): 用户下载选项。
        downloader (YouTubeDownloader): 下载器实例。
    """
    
    # 将任务更新函数设置为下载器的进度回调
    downloader.set_progress_callback(
        lambda progress: _update_task_progress(task_id, progress)
    )

    # 调用下载器执行下载，这是一个阻塞操作
    result = downloader.download(url, user_options)

    # 下载结束后，根据结果更新最终状态
    final_status = {}
    if result.get('success'):
        final_status['status'] = 'completed'
    else:
        final_status['status'] = 'error'
        final_status['error'] = result.get('error', '未知下载错误')
    
    _update_task_progress(task_id, final_status)
    logger.info(f"任务 {task_id} 已完成，状态: {final_status['status']}")
