# backend/ytdlp_utils.py

import os
import shutil
from pathlib import Path
from typing import Dict, Any, Optional

QUALITY_MAP = {
    'best': 'bestvideo*+bestaudio/best',
    '1080p': 'bestvideo[height<=1080]+bestaudio/best[height<=1080]',
    '720p': 'bestvideo[height<=720]+bestaudio/best[height<=720]',
    '4K': 'bestvideo[height<=2160]+bestaudio/best[height<=2160]',
    'worst': 'worstvideo*+worstaudio/worst',
}

def find_ffmpeg() -> Optional[str]:
    """
    查找 ffmpeg 可执行文件。
    优先顺序:
    1. 从 'FFMPEG_PATH' 环境变量获取 (由 Electron 在打包应用中注入)。
    2. 在系统 PATH 中查找。
    """
    # 1. 检查环境变量
    ffmpeg_from_env = os.environ.get('FFMPEG_PATH')
    if ffmpeg_from_env and os.path.isfile(ffmpeg_from_env):
        return ffmpeg_from_env
        
    # 2. 在系统 PATH 中查找
    return shutil.which('ffmpeg')

def build_download_options(
    user_options: Dict[str, Any],
    default_outtmpl: str,
    downloads_dir: Path
) -> Dict[str, Any]:
    """根据用户选择构建 yt-dlp 的下载参数字典"""
    
    # 基础配置
    ydl_opts = {
        'quiet': True,
        'no_warnings': True,
        'ignoreerrors': True,
        'merge_output_format': 'mp4',
        'ffmpeg_location': find_ffmpeg(),
    }

    if user_options.get('audioOnly'):
        audio_format = user_options.get('format', 'mp3')
        ydl_opts.update({
            'format': 'bestaudio/best',
            'postprocessors': [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': audio_format,
                'preferredquality': '192',
            }],
        })
    else:
        quality = user_options.get('quality', 'best')
        ydl_opts['format'] = QUALITY_MAP.get(quality, 'bestvideo*+bestaudio/best')
        
        video_format = user_options.get('format', 'mp4')
        if video_format != 'mp4':
            ydl_opts.setdefault('postprocessors', []).append({
                'key': 'FFmpegVideoConvertor',
                'preferedformat': video_format,
            })

    if user_options.get('subtitle'):
        ydl_opts.update({
            'writesubtitles': True,
            'writeautomaticsub': True,
            'subtitleslangs': ['en', 'zh-Hans', 'zh-Hant'],
        })

    if user_options.get('thumbnail'):
        ydl_opts['writethumbnail'] = True

    if user_options.get('playlist'):
        ydl_opts['noplaylist'] = False
        playlist_outtmpl = str(downloads_dir / '%(playlist_title)s/%(playlist_index)s - %(title)s.%(ext)s')
        ydl_opts['outtmpl'] = playlist_outtmpl
    else:
        ydl_opts['noplaylist'] = True
        ydl_opts['outtmpl'] = default_outtmpl

    return ydl_opts