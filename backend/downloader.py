# backend/downloader.py

import logging
from pathlib import Path
from typing import Dict, Any, Optional, Callable
import yt_dlp

from backend.config import Config
# --- MODIFICATION: Import find_ffmpeg ---
from backend.ytdlp_utils import build_download_options, find_ffmpeg

logger = logging.getLogger(__name__)


class YouTubeDownloader:
    """
    Core class for executing yt-dlp downloads and related file operations.

    This class encapsulates video-info fetching, download execution, history querying,
    and file deletion. It is designed to be invoked from a background worker thread
    (tasks.py).
    """

    def __init__(self, config: Config):
        """
        Initialize the downloader.

        Args:
            config (Config): Application-wide configuration instance injected via DI.
        """
        self.config = config
        # Initialize progress callback to None; each download task will set it temporarily.
        self.progress_callback: Optional[Callable[[Dict[str, Any]], None]] = None

    def set_progress_callback(self, callback: Callable[[Dict[str, Any]], None]):
        """
        Set the progress-report callback for the current download task.

        Args:
            callback (Callable): A function that receives a dict containing progress info.
        """
        self.progress_callback = callback

    def clear_progress_callback(self):
        """
        Clear the progress callback after a task finishes to prevent cross-calls.
        """
        self.progress_callback = None

    def _progress_hook(self, d: Dict[str, Any]):
        """
        yt-dlp internal progress hook.

        Called whenever yt-dlp updates download status. It parses the progress data
        and forwards it to the task manager via self.progress_callback.
        """
        if not self.progress_callback:
            return

        status = d.get("status")
        if status == "downloading":
            total_bytes = d.get("total_bytes") or d.get("total_bytes_estimate", 0)
            downloaded_bytes = d.get("downloaded_bytes", 0)
            percent = (downloaded_bytes / total_bytes * 100) if total_bytes > 0 else 0

            self.progress_callback(
                {
                    "status": "downloading",
                    "percent": percent,
                    "total": total_bytes,
                    "downloaded": downloaded_bytes,
                    "speed": d.get("speed", 0),
                    "eta": d.get("eta", 0),
                }
            )
        elif status == "finished":
            filename = d.get("filename", "N/A")
            logger.info(
                f"File download finished: {Path(filename).name}. Waiting for post-processing..."
            )
            # Status 'finished' means the raw file is downloaded; ffmpeg may still merge or convert.
            self.progress_callback(
                {"status": "processing", "message": "Merging formats..."}
            )
        elif status == "error":
            logger.error("yt-dlp progress hook reported a download error.")
            self.progress_callback(
                {"status": "error", "error": "Unknown error during download"}
            )

    def get_video_info(self, url: str) -> Dict[str, Any]:
        """
        Fetch video information only, without downloading.

        Args:
            url (str): Video URL.

        Returns:
            Dict[str, Any]: Dictionary with key video information needed by the frontend.

        Raises:
            yt_dlp.utils.DownloadError: If the URL is invalid, private, or unreachable, etc.
        """
        logger.info(f"Fetching video info: {url}")

        ydl_opts = {"quiet": True, "no_warnings": True}
        if self.config.proxy_enabled and self.config.proxy_url:
            ydl_opts["proxy"] = self.config.proxy_url

        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=False)
                if not info:
                    raise yt_dlp.utils.DownloadError("yt-dlp returned no information.")

                logger.info(
                    f"Successfully fetched video info: '{info.get('title', 'N/A')}'"
                )
                # Return only the data the frontend needs
                return {
                    "title": info.get("title", "Unknown title"),
                    "duration": info.get("duration", 0),
                    "uploader": info.get("uploader", "Unknown uploader"),
                    "view_count": info.get("view_count", 0),
                    "thumbnail": info.get("thumbnail", ""),
                }
        except yt_dlp.utils.DownloadError as e:
            logger.error(f"Failed to fetch video info for URL '{url}': {e}")
            # Re-raise the native yt-dlp exception so the API layer can catch it and return an appropriate status code.
            raise e

    def download(self, url: str, user_options: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute the full download flow according to user options and global config.

        Args:
            url (str): Video URL.
            user_options (Dict[str, Any]): Per-download options sent from the frontend.

        Returns:
            Dict[str, Any]: A dict indicating success or failure.
        """
        logger.info(f"Preparing download task. URL: {url}, options: {user_options}")

        # --- MODIFICATION START ---
        # Pre-download check: Ensure FFmpeg is available for video downloads, as it's
        # almost always required for merging video and audio streams.
        is_audio_only = user_options.get("audioOnly", False)
        if not is_audio_only:
            ffmpeg_path = find_ffmpeg()
            if not ffmpeg_path:
                error_message = "FFmpeg not found. It is required to merge video and audio. Please install FFmpeg and ensure it's in the system's PATH."
                logger.error(error_message)
                return {"success": False, "error": error_message}
            else:
                logger.info(f"FFmpeg found at: {ffmpeg_path}")
        # --- MODIFICATION END ---

        ydl_opts = build_download_options(user_options, self.config)
        ydl_opts["progress_hooks"] = [self._progress_hook]

        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                ydl.download([url])
            return {"success": True}
        except Exception as e:
            # Catch any Python exception during download
            logger.error(f"Download task failed for URL '{url}': {e}", exc_info=True)
            return {"success": False, "error": str(e)}

    def get_download_history(self) -> list:
        """
        Scans the downloads directory and returns a list of files, sorted by creation time descending.
        """
        files = []
        # Ensure the downloads directory exists in case the user deleted it while the program was running
        self.config.DOWNLOADS_DIR.mkdir(exist_ok=True, parents=True)

        for file_path in self.config.DOWNLOADS_DIR.iterdir():
            if file_path.is_file() and not file_path.name.startswith("."):
                try:
                    stat = file_path.stat()
                    files.append(
                        {
                            "name": file_path.name,
                            "size": stat.st_size,
                            "created": stat.st_ctime,
                            "path": str(file_path),
                        }
                    )
                except FileNotFoundError:
                    # File may have been deleted during iteration; this is an expected race condition—ignore safely.
                    continue

        return sorted(files, key=lambda x: x["created"], reverse=True)

    def delete_file(self, filename: str):
        """
        Safely deletes the specified file from the downloads directory.
        """
        base_dir = self.config.DOWNLOADS_DIR.resolve()
        file_path = (base_dir / filename).resolve()

        # Security: re-validate that the resolved path is still inside the intended downloads directory to prevent path traversal
        if not str(file_path).startswith(str(base_dir)):
            logger.warning(
                f"Refusing to delete file outside downloads directory: {file_path}"
            )
            raise PermissionError(
                "Deletion of files outside the downloads directory is not allowed."
            )

        try:
            file_path.unlink()
            logger.info(f"File successfully deleted: {file_path}")
        except FileNotFoundError:
            logger.warning(f"Attempted to delete non-existent file: {file_path}")
        except IsADirectoryError:
            logger.warning(f"Refusing to delete directory: {file_path}")
            raise PermissionError("Cannot delete directories—only files.")
        except Exception as e:
            logger.error(
                f"Unknown error while deleting file '{file_path}': {e}", exc_info=True
            )
            raise e