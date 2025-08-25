# backend/downloader.py

import logging
from pathlib import Path
from typing import Dict, Any, Optional, Callable
import yt_dlp
from .config import Config
from .ytdlp_utils import build_download_options

logger = logging.getLogger(__name__)

class YouTubeDownloader:
    """执行 yt-dlp 下载的核心类"""
    def __init__(self, config: Config):
        self.config = config
        self.progress_callback: Optional[Callable] = None

    def set_progress_callback(self, callback: Callable):
        """设置用于报告进度的回调函数"""
        self.progress_callback = callback

    def _progress_hook(self, d: Dict[str, Any]):
        """yt-dlp 的进度钩子，当中继信息给回调函数"""
        if not self.progress_callback:
            return
        
        status = d.get('status')
        if status == 'downloading':
            total = d.get('total_bytes') or d.get('total_bytes_estimate') or 0
            downloaded = d.get('downloaded_bytes', 0)
            percent = (downloaded / total * 100) if total > 0 else 0
            
            self.progress_callback({
                'status': 'downloading',
                'percent': percent,
                'total': total,
                'speed': d.get('speed', 0),
                'eta': d.get('eta', 0),
            })
        elif status == 'finished':
            self.progress_callback({
                'status': 'finished',
                'filename': d.get('filename')
            })

    def get_video_info(self, url: str) -> Dict[str, Any]:
        """获取视频的基本信息，不下载"""
        logger.info(f"获取视频信息: {url}")
        with yt_dlp.YoutubeDL({'quiet': True, 'no_warnings': True}) as ydl:
            info = ydl.extract_info(url, download=False)
            if not info:
                raise ValueError("无法获取视频信息")
            return {
                'title': info.get('title', '未知标题'),
                'duration': info.get('duration', 0),
                'uploader': info.get('uploader', '未知上传者'),
                'view_count': info.get('view_count', 0),
                'thumbnail': info.get('thumbnail', ''),
            }

    def download(self, url: str, user_options: Dict[str, Any]) -> Dict[str, Any]:
        """执行下载"""
        logger.info(f"开始下载: {url}，选项: {user_options}")
        ydl_opts = build_download_options(
            user_options,
            self.config.YTDLP_DEFAULT_OUTTMPL,
            self.config.DOWNLOADS_DIR
        )
        ydl_opts['progress_hooks'] = [self._progress_hook]

        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                ydl.download([url])
            return {'success': True}
        except Exception as e:
            logger.error(f"yt-dlp 下载失败: {e}", exc_info=True)
            return {'success': False, 'error': str(e)}

    def get_download_history(self) -> list:
        """获取下载目录中的文件列表"""
        files = []
        for file_path in self.config.DOWNLOADS_DIR.rglob('*'):
            if file_path.is_file() and not file_path.name.startswith('.'):
                stat = file_path.stat()
                files.append({
                    'name': file_path.name,
                    'size': stat.st_size,
                    'created': stat.st_ctime,
                    'path': str(file_path),
                })
        # 按创建时间降序排序
        return sorted(files, key=lambda x: x['created'], reverse=True)

    def delete_file(self, filename: str):
        """删除下载目录中的指定文件"""
        file_path = self.config.DOWNLOADS_DIR / filename
        # 安全检查
        if str(file_path.resolve()).startswith(str(self.config.DOWNLOADS_DIR.resolve())):
            if file_path.exists():
                file_path.unlink()
                logger.info(f"文件已删除: {file_path}")
            else:
                logger.warning(f"尝试删除不存在的文件: {file_path}")
        else:
            raise PermissionError(f"不允许删除非下载目录中的文件: {file_path}")