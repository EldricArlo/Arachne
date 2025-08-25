# backend/tasks.py

import uuid
import threading
import logging
from typing import Dict, Any, Optional

# Use a type alias to avoid runtime issues caused by circular imports,
# while still providing necessary information for static type checkers like MyPy.
from typing import TYPE_CHECKING
if TYPE_CHECKING:
    from backend.downloader import YouTubeDownloader

logger = logging.getLogger(__name__)

# --- In-memory task storage ---
# The _tasks dict is the core of the application state, holding all task information.
# Keys are task IDs (str); values are dicts containing task status and progress.
# It is global by design, but should only be accessed through the functions in this module.
_tasks: Dict[str, Dict[str, Any]] = {}
# _tasks_lock is a thread lock that protects the _tasks dict.
# Because download tasks run in different threads, any read or write to _tasks
# must be performed while holding this lock to prevent data races and inconsistent state.
_tasks_lock = threading.Lock()

def get_active_downloads_count() -> int:
    """Thread-safely return the number of tasks currently queued or downloading."""
    with _tasks_lock:
        return len([
            task for task in _tasks.values()
            if task.get('status') in ['downloading', 'queued', 'processing']
        ])

def get_task_status(task_id: str) -> Optional[Dict[str, Any]]:
    """Thread-safely return the current state of a single task."""
    with _tasks_lock:
        # Return a .copy() to prevent external code from accidentally mutating internal state
        return _tasks.get(task_id, {}).copy()

def create_download_task(
    url: str,
    user_options: Dict[str, Any],
    downloader: 'YouTubeDownloader'
) -> str:
    """
    Create a new background download task and start a thread to run it.

    Args:
        url (str): The video URL to download.
        user_options (Dict[str, Any]): Download options chosen by the user in the frontend.
        downloader (YouTubeDownloader): A downloader instance injected via DI.

    Returns:
        str: The unique ID of the newly created task.
    """
    task_id = str(uuid.uuid4())

    with _tasks_lock:
        _tasks[task_id] = {'status': 'queued', 'url': url, 'percent': 0}

    # Spawn a background thread to perform the download, preventing blocking of the main Flask thread
    thread = threading.Thread(
        target=_download_worker,
        args=(task_id, url, user_options, downloader),
        # Name the thread; useful when inspecting logs or debugging
        name=f"Task-{task_id[:8]}",
        daemon=True  # Mark as daemon so it is force-stopped when the main program exits
    )
    thread.start()

    logger.info(f"[Task {task_id}] Created and queued. URL: {url}")
    return task_id

def _update_task_progress(task_id: str, progress_data: Dict[str, Any]):
    """Thread-safely update a task's progress. Called by the downloader's callback."""
    with _tasks_lock:
        if task_id in _tasks:
            current_status = _tasks[task_id].get('status')
            new_status = progress_data.get('status')

            # Optimization: log only when the status actually changes to avoid spam from percent updates
            if new_status and new_status != current_status:
                logger.debug(f"[Task {task_id}] Status update: {current_status} -> {new_status}")

            _tasks[task_id].update(progress_data)
        else:
            logger.warning(f"[Task {task_id}] Attempted to update a task that no longer exists.")

def _download_worker(
    task_id: str,
    url: str,
    user_options: Dict[str, Any],
    downloader: 'YouTubeDownloader'
):
    """
    The actual work function that performs the download, running in a dedicated background thread.
    """
    logger.info(f"[Task {task_id}] Worker thread started; preparing to download.")

    try:
        # 1. Wire the current task's callback into the downloader instance
        #    Use a lambda to capture the current task_id
        downloader.set_progress_callback(
            lambda progress: _update_task_progress(task_id, progress)
        )

        # 2. Call the downloader to execute the download (blocking call)
        result = downloader.download(url, user_options)

        # 3. Update final state based on the download result
        final_status = {}
        if result.get('success'):
            final_status['status'] = 'completed'
            final_status['percent'] = 100
        else:
            error_message = result.get('error', 'Unknown download error')
            final_status['status'] = 'error'
            final_status['error'] = error_message
            logger.error(f"[Task {task_id}] Download failed: {error_message}")

        _update_task_progress(task_id, final_status)

    except Exception as e:
        # Catch any unexpected exception in the worker thread
        logger.error(f"[Task {task_id}] Uncaught exception in worker thread: {e}", exc_info=True)
        _update_task_progress(task_id, {'status': 'error', 'error': 'A critical error occurred in the worker thread.'})

    finally:
        # 4. Clean up the callback so it is ready for the next task
        downloader.clear_progress_callback()
        logger.info(f"[Task {task_id}] Worker thread ended.")