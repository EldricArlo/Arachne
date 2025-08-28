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
# --- MODIFICATION: Simplified format strings for clarity ---
QUALITY_MAP = {
    "best": "bestvideo+bestaudio/best",
    "4K": "bestvideo[height<=2160]+bestaudio/best[height<=2160]",
    "1080p": "bestvideo[height<=1080]+bestaudio/best[height<=1080]",
    "720p": "bestvideo[height<=720]+bestaudio/best[height<=720]",
    "worst": "worstvideo+worstaudio/worst",
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
    ffmpeg_from_env = os.environ.get("FFMPEG_PATH")
    if ffmpeg_from_env and Path(ffmpeg_from_env).is_file():
        return ffmpeg_from_env
    return shutil.which("ffmpeg")


def build_download_options(
    user_options: Dict[str, Any], config: "Config"
) -> Dict[str, Any]:
    """
    Build the yt-dlp parameter dictionary based on user choices and global config.

    Args:
        user_options (Dict[str, Any]): Options for this specific download.
        config (Config): Application-wide configuration instance.

    Returns:
        Dict[str, Any]: A ready-to-use parameter dictionary for yt-dlp.
    """

    # --- 1. Base configuration (applied to every download) ---
    ydl_opts: Dict[str, Any] = {
        "outtmpl": config.YTDLP_DEFAULT_OUTTMPL,
        "quiet": True,
        "no_warnings": True,
        "ignoreerrors": True,
        "merge_output_format": "mp4",
        "ffmpeg_location": find_ffmpeg(),
        "source_address": "0.0.0.0",  # Force IPv4
    }

    # --- 2. Load persistent settings from global config (config.yaml) ---

    if config.proxy_enabled and config.proxy_url:
        ydl_opts["proxy"] = config.proxy_url

    cookies_path = config.COOKIES_PATH
    if (
        cookies_path.exists()
        and cookies_path.is_file()
        and cookies_path.stat().st_size > 0
    ):
        ydl_opts["cookiefile"] = str(cookies_path)

    if config.use_aria2:
        ydl_opts["external_downloader"] = "aria2c"
        aria2_args = ["-x", "16", "-s", "16", "-k", "1M"]
        if ydl_opts.get("proxy"):
            aria2_args.append(f'--all-proxy={ydl_opts["proxy"]}')
        # --- MODIFICATION: Corrected argument structure for aria2c ---
        ydl_opts["external_downloader_args"] = aria2_args

    if config.limit_rate and config.limit_rate.strip() != "0":
        ydl_opts["limit_rate"] = config.limit_rate.strip().upper()

    postprocessors = []

    if config.embed_chapters:
        postprocessors.append({"key": "FFmpegMetadata", "add_chapters": True})

    # --- 3. Handle per-download options from the frontend (`user_options`) ---

    if user_options.get("audioOnly"):
        audio_format = user_options.get("format", "mp3")
        ydl_opts["format"] = "bestaudio/best"
        postprocessors.append(
            {
                "key": "FFmpegExtractAudio",
                "preferredcodec": audio_format,
                "preferredquality": "192",
            }
        )
    else:
        quality = user_options.get("quality", "best")
        ydl_opts["format"] = QUALITY_MAP.get(quality, "bestvideo+bestaudio/best")

        video_format = user_options.get("format", "mp4")
        if video_format != "mp4":
            postprocessors.append(
                {
                    "key": "FFmpegVideoConvertor",
                    # --- MODIFICATION: Corrected critical typo 'preferedformat' -> 'preferredformat' ---
                    "preferredformat": video_format,
                }
            )

    # --- 4. Handle additional data options based on global config ---

    if config.embed_subtitles:
        ydl_opts["writesubtitles"] = True
        ydl_opts["subtitleslangs"] = ["en", "en.*", "live_chat"]
        postprocessors.append({"key": "FFmpegEmbedSubtitle"})

    if config.save_thumbnail:
        ydl_opts["writethumbnail"] = True
        if config.embed_thumbnail:
            postprocessors.append({"key": "EmbedThumbnail"})

    if postprocessors:
        ydl_opts["postprocessors"] = postprocessors

    return ydl_opts