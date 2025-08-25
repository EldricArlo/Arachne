# backend/tasks.py

import uuid
import threading
import logging
from typing import Dict, Any, Optional, Callable

# 注意：这里不再导入 downloader，它将由 app.py 传入
# from .downloader import YouTubeDownloader 

logger = logging.getLogger(__name__)

# 内存中的任务存储
_tasks: Dict[str, Dict[str, Any]] = {}
_tasks_lock = threading.Lock()

def get_active_downloads_count() -> int:
    """获取当前正在下载的任务数量"""
    with _tasks_lock:
        return len([
            task for task in _tasks.values() 
            if task.get('status') == 'downloading'
        ])

def get_task_status(task_id: str) -> Optional[Dict[str, Any]]:
    """获取单个任务的状态"""
    with _tasks_lock:
        return _tasks.get(task_id)

# 关键修正：downloader 现在作为参数传入
def create_download_task(url: str, user_options: Dict[str, Any], downloader) -> str:
    """创建一个新的下载任务，并返回任务ID"""
    task_id = str(uuid.uuid4())
    
    with _tasks_lock:
        _tasks[task_id] = {'status': 'queued'}

    thread = threading.Thread(
        target=_download_worker,
        args=(task_id, url, user_options, downloader),
        daemon=True
    )
    thread.start()
    
    logger.info(f"任务 {task_id} 已创建并排队: {url}")
    return task_id

def _update_task_progress(task_id: str, progress_data: Dict[str, Any]):
    """线程安全地更新任务进度"""
    with _tasks_lock:
        if task_id in _tasks:
            _tasks[task_id].update(progress_data)

def _download_worker(task_id: str, url: str, user_options: Dict[str, Any], downloader):
    """实际执行下载的工作函数，在单独的线程中运行"""
    
    downloader.set_progress_callback(
        lambda progress: _update_task_progress(task_id, progress)
    )

    result = downloader.download(url, user_options)

    final_status = {}
    if result['success']:
        final_status['status'] = 'completed'
    else:
        final_status['status'] = 'error'
        final_status['error'] = result.get('error', '未知下载错误')
    
    _update_task_progress(task_id, final_status)
    logger.info(f"任务 {task_id} 已完成，状态: {final_status['status']}")