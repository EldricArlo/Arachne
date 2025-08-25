# backend/ytdlp_utils.py

import os
import shutil
from pathlib import Path
from typing import Dict, Any, Optional

# Use a type alias to avoid runtime issues caused by circular imports,
# while still providing information for static type checkers.
from typing import TYPE_CHECKING
if TYPE_CHECKING:
    from backend.config import Config

# Preset mapping of video quality to yt-dlp format strings.
# These are convenient options presented to users.
QUALITY_MAP = {
    'best': 'bestvideo*+bestaudio/best',
    '4K': 'bestvideo[height<=2160]+bestaudio/best[height<=2160]',
    '1080p': 'bestvideo[height<=1080]+bestaudio/best[height<=1080]',
    '720p': 'bestvideo[height<=720]+bestaudio/best[height<=720]',
    'worst': 'worstvideo*+worstaudio/worst',
}

def find_ffmpeg() -> Optional[str]:
    """
    Intelligently locate the FFmpeg executable.

    Search order:
    1. Environment variable FFMPEG_PATH (set by electron/python-manager.js in packaged apps).
    2. System PATH environment variable.

    Returns:
        Optional[str]: Absolute path to the FFmpeg executable, or None if not found.
    """
    ffmpeg_from_env = os.environ.get('FFMPEG_PATH')
    if ffmpeg_from_env and Path(ffmpeg_from_env).is_file():
        return ffmpeg_from_env
    # shutil.which searches the system PATH for the executable
    return shutil.which('ffmpeg')

def build_download_options(
    user_options: Dict[str, Any],
    config: 'Config'
) -> Dict[str, Any]:
    """
    Build the yt-dlp parameter dictionary based on choices made in the frontend
    and the application's persistent configuration.

    Args:
        user_options (Dict[str, Any]): Options sent from the frontend that apply only to this download.
        config (Config): Application-wide configuration instance.

    Returns:
        Dict[str, Any]: A ready-to-use parameter dictionary for yt-dlp.
    """

    # --- 1. Base configuration (applied to every download) ---
    ydl_opts: Dict[str, Any] = {
        'outtmpl': config.YTDLP_DEFAULT_OUTTMPL,
        'quiet': True,
        'no_warnings': True,
        'ignoreerrors': True,
        'merge_output_format': 'mp4',  # Default merge to mp4
        'ffmpeg_location': find_ffmpeg(),
        # Force IPv4 to avoid stalls caused by slow IPv6 resolution on some networks
        'source_address': '0.0.0.0'
    }

    # --- 2. Load persistent settings from global config (config.yaml) ---

    # Proxy
    if config.proxy_enabled and config.proxy_url:
        ydl_opts['proxy'] = config.proxy_url

    # Aria2c external downloader
    if config.use_aria2:
        ydl_opts['external_downloader'] = 'aria2c'
        # Build arguments for aria2c, e.g. 16 concurrent connections
        aria2_args = ['-x', '16', '-s', '16', '-k', '1M']
        # Inform aria2c of the proxy if one is configured
        if ydl_opts.get('proxy'):
            aria2_args.append(f'--all-proxy={ydl_opts["proxy"]}')
        ydl_opts['external_downloader_args'] = {'default': aria2_args}

    # Rate limit
    if config.limit_rate and config.limit_rate.strip() != '0':
        ydl_opts['limit_rate'] = config.limit_rate.strip().upper()
        
    # Initialize postprocessors list
    postprocessors = []

    # Embed chapters
    if config.embed_chapters:
        postprocessors.append({
            'key': 'FFmpegMetadata',
            'add_chapters': True,
        })

    # --- 3. Handle per-download options from the frontend (`user_options`) ---

    # -- Audio-only option --
    if user_options.get('audioOnly'):
        audio_format = user_options.get('format', 'mp3')
        ydl_opts['format'] = 'bestaudio/best'
        postprocessors.append({
            'key': 'FFmpegExtractAudio',
            'preferredcodec': audio_format,
            'preferredquality': '192',  # Default quality 192 kbps
        })
    else:
        # -- Video options --
        quality = user_options.get('quality', 'best')
        ydl_opts['format'] = QUALITY_MAP.get(quality, 'bestvideo*+bestaudio/best')

        video_format = user_options.get('format', 'mp4')
        if video_format != 'mp4':  # Only add converter if a non-mp4 format is requested
            postprocessors.append({
                'key': 'FFmpegVideoConvertor',
                'preferedformat': video_format,
            })

    # --- 4. Handle additional data options based on global config ---

    # Subtitles
    if config.embed_subtitles:
        ydl_opts['writesubtitles'] = True
        ydl_opts['subtitleslangs'] = ['en', 'en.*', 'live_chat'] # Example: download English and live chat
        postprocessors.append({
            'key': 'FFmpegEmbedSubtitle',
        })
        
    # Thumbnails
    if config.save_thumbnail:
        ydl_opts['writethumbnail'] = True
        if config.embed_thumbnail:
            postprocessors.append({
                'key': 'EmbedThumbnail',
            })

    # Finally, if the postprocessors list is not empty, add it to ydl_opts
    if postprocessors:
        ydl_opts['postprocessors'] = postprocessors

    return ydl_opts