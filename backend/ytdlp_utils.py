# backend/ytdlp_utils.py

import os
import shutil
from pathlib import Path
from typing import Dict, Any, Optional

# 预设的视频质量与 yt-dlp format 参数的映射
# 这使得用户可以选择简单的质量名称，而无需了解 yt-dlp 的复杂语法。
QUALITY_MAP = {
    'best': 'bestvideo*+bestaudio/best',
    '1080p': 'bestvideo[height<=1080]+bestaudio/best[height<=1080]',
    '720p': 'bestvideo[height<=720]+bestaudio/best[height<=720]',
    '4K': 'bestvideo[height<=2160]+bestaudio/best[height<=2160]',
    'worst': 'worstvideo*+worstaudio/worst',
}

def find_ffmpeg() -> Optional[str]:
    """
    智能查找 FFmpeg 可执行文件。
    
    这是确保应用可移植性的关键函数，尤其是在打包后。
    查找顺序:
    1. 环境变量 'FFMPEG_PATH'：这通常由 Electron 的打包过程注入，指向捆绑的 FFmpeg。
    2. 系统 PATH：如果环境变量未设置，则尝试在系统的 PATH 路径中查找。

    Returns:
        Optional[str]: FFmpeg 的可执行文件路径，如果找不到则返回 None。
    """
    # 1. 检查由 Electron 注入的环境变量
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
    """
    根据用户在前端的选择，构建 yt-dlp 的下载参数字典。

    Args:
        user_options (Dict[str, Any]): 从前端传递的用户选项，如质量、格式等。
        default_outtmpl (str): 默认的文件输出模板。
        downloads_dir (Path): 下载目录的 Path 对象。

    Returns:
        Dict[str, Any]: 构建好的、可直接用于 yt-dlp 的参数字典。
    """
    
    # 基础配置，确保下载过程安静无扰，并指定 FFmpeg 位置
    ydl_opts = {
        'quiet': True,
        'no_warnings': True,
        'ignoreerrors': True,
        'merge_output_format': 'mp4',  # 合并视频和音频时，默认使用 mp4 容器
        'ffmpeg_location': find_ffmpeg(),
    }

    # -- 处理仅音频选项 --
    if user_options.get('audioOnly'):
        audio_format = user_options.get('format', 'mp3')
        ydl_opts.update({
            'format': 'bestaudio/best',  # 选择最佳质量的音频流
            'postprocessors': [{
                'key': 'FFmpegExtractAudio',  # 使用 FFmpeg 提取音频
                'preferredcodec': audio_format,  # 用户选择的音频编码
                'preferredquality': '192',  # 音频质量
            }],
        })
    else:
        # -- 处理视频选项 --
        quality = user_options.get('quality', 'best')
        ydl_opts['format'] = QUALITY_MAP.get(quality, 'bestvideo*+bestaudio/best')
        
        # 如果需要转换视频格式
        video_format = user_options.get('format', 'mp4')
        if video_format != 'mp4':
            # 使用 postprocessors 在下载后进行格式转换
            ydl_opts.setdefault('postprocessors', []).append({
                'key': 'FFmpegVideoConvertor',
                'preferedformat': video_format,
            })

    # -- 处理附加选项 --
    if user_options.get('subtitle'):
        ydl_opts.update({
            'writesubtitles': True,
            'writeautomaticsub': True,  # 也下载自动生成的字幕
            'subtitleslangs': ['en', 'zh-Hans', 'zh-Hant'],  # 字幕语言偏好
        })

    if user_options.get('thumbnail'):
        ydl_opts['writethumbnail'] = True

    # -- 处理播放列表选项 --
    if user_options.get('playlist'):
        ydl_opts['noplaylist'] = False
        # 为播放列表设置特殊的输出模板，将视频按顺序保存在以播放列表标题命名的子目录中
        playlist_outtmpl = str(downloads_dir / '%(playlist_title)s/%(playlist_index)s - %(title)s.%(ext)s')
        ydl_opts['outtmpl'] = playlist_outtmpl
    else:
        # 如果不是播放列表，则禁用播放列表下载并使用默认输出模板
        ydl_opts['noplaylist'] = True
        ydl_opts['outtmpl'] = default_outtmpl

    return ydl_opts
