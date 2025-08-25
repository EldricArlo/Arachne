# backend/downloader.py

import logging
from pathlib import Path
from typing import Dict, Any, Optional, Callable
import yt_dlp
from .config import Config
from .ytdlp_utils import build_download_options

logger = logging.getLogger(__name__)

class YouTubeDownloader:
    """
    执行 yt-dlp 下载和相关文件操作的核心类。
    
    封装了视频信息获取、下载执行、历史记录查询和文件删除等功能。
    """
    def __init__(self, config: Config):
        """
        初始化下载器。

        Args:
            config (Config): 应用程序的配置实例。
        """
        self.config = config
        self.progress_callback: Optional[Callable] = None

    def set_progress_callback(self, callback: Callable):
        """
        设置用于报告下载进度的回调函数。
        
        这个回调函数会被下载工作线程调用，以将进度信息传递给任务管理器。

        Args:
            callback (Callable): 回调函数，接收一个包含进度信息的字典。
        """
        self.progress_callback = callback

    def _progress_hook(self, d: Dict[str, Any]):
        """
        yt-dlp 的进度钩子函数。
        
        这个函数会在下载过程中的不同阶段被 yt-dlp 调用。
        它的主要作用是解析进度数据，并将其传递给我们设置的回调函数。
        """
        if not self.progress_callback:
            return
        
        status = d.get('status')
        if status == 'downloading':
            # 提取下载进度信息
            total = d.get('total_bytes') or d.get('total_bytes_estimate') or 0
            downloaded = d.get('downloaded_bytes', 0)
            percent = (downloaded / total * 100) if total > 0 else 0
            
            # 通过回调函数报告进度
            self.progress_callback({
                'status': 'downloading',
                'percent': percent,
                'total': total,
                'speed': d.get('speed', 0),
                'eta': d.get('eta', 0),
            })
        elif status == 'finished':
            # 下载完成，进入后期处理阶段（如合并音视频）
            self.progress_callback({
                'status': 'finished',
                'filename': d.get('filename')
            })

    def get_video_info(self, url: str) -> Dict[str, Any]:
        """
        获取视频的基本信息，而不进行下载。

        Args:
            url (str): 视频的 URL。

        Returns:
            Dict[str, Any]: 包含视频标题、时长、上传者等信息的字典。
        
        Raises:
            ValueError: 如果无法从 URL 获取信息。
        """
        logger.info(f"正在获取视频信息: {url}")
        # 使用 'quiet' 和 'no_warnings' 避免在控制台打印不必要的信息
        with yt_dlp.YoutubeDL({'quiet': True, 'no_warnings': True}) as ydl:
            info = ydl.extract_info(url, download=False)
            if not info:
                raise ValueError("无法获取视频信息")
            
            # 提取前端需要展示的关键信息
            return {
                'title': info.get('title', '未知标题'),
                'duration': info.get('duration', 0),
                'uploader': info.get('uploader', '未知上传者'),
                'view_count': info.get('view_count', 0),
                'thumbnail': info.get('thumbnail', ''),
            }

    def download(self, url: str, user_options: Dict[str, Any]) -> Dict[str, Any]:
        """
        根据用户选项执行下载。

        Args:
            url (str): 要下载的视频 URL。
            user_options (Dict[str, Any]): 从前端传递的用户选项。

        Returns:
            Dict[str, Any]: 一个指示下载成功与否的字典。
        """
        logger.info(f"开始下载: {url}，选项: {user_options}")
        
        # 使用工具函数构建 yt-dlp 的参数
        ydl_opts = build_download_options(
            user_options,
            self.config.YTDLP_DEFAULT_OUTTMPL,
            self.config.DOWNLOADS_DIR
        )
        # 将我们的进度钩子添加到参数中
        ydl_opts['progress_hooks'] = [self._progress_hook]

        try:
            # 使用 with 上下文管理器确保资源被正确释放
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                ydl.download([url])
            return {'success': True}
        except Exception as e:
            logger.error(f"yt-dlp 下载失败: {e}", exc_info=True)
            return {'success': False, 'error': str(e)}

    def get_download_history(self) -> list:
        """
        扫描下载目录并返回其中的文件列表。

        Returns:
            list: 包含每个文件信息的字典列表，并按创建时间降序排序。
        """
        files = []
        # 使用 rglob('*') 递归地查找所有文件和文件夹
        for file_path in self.config.DOWNLOADS_DIR.rglob('*'):
            # 确保是文件且不是隐藏文件
            if file_path.is_file() and not file_path.name.startswith('.'):
                stat = file_path.stat()
                files.append({
                    'name': file_path.name,
                    'size': stat.st_size,
                    'created': stat.st_ctime,  # 使用 ctime 作为创建时间
                    'path': str(file_path),
                })
        # 按创建时间降序排序，让最新的文件显示在最前面
        return sorted(files, key=lambda x: x['created'], reverse=True)

    def delete_file(self, filename: str):
        """
        从下载目录中删除指定的文件。

        Args:
            filename (str): 要删除的文件名。

        Raises:
            PermissionError: 如果尝试删除下载目录之外的文件。
        """
        file_path = self.config.DOWNLOADS_DIR / filename
        
        # --- 安全性检查 ---
        # 确保要删除的文件确实在指定的下载目录内，防止路径遍历攻击。
        if str(file_path.resolve()).startswith(str(self.config.DOWNLOADS_DIR.resolve())):
            if file_path.exists() and file_path.is_file():
                file_path.unlink()  # 删除文件
                logger.info(f"文件已删除: {file_path}")
            else:
                logger.warning(f"尝试删除一个不存在的文件: {file_path}")
        else:
            # 如果路径不安全，则引发权限错误
            raise PermissionError(f"不允许删除非下载目录中的文件: {file_path}")
