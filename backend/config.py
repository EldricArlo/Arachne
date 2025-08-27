# backend/config.py

import yaml
import logging
from pathlib import Path
from typing import Optional, Dict, Any
import copy  # Used to create a deep copy of the default configuration

logger = logging.getLogger(__name__)

# Defines a dictionary with default configuration values.
# These are the application's "factory settings." If config.yaml is missing or corrupted,
# the program will fall back to these values.
DEFAULT_CONFIG = {
    # --- Core Paths ---
    "downloads_dir": None,
    # --- Performance & Behavior ---
    "max_concurrent_downloads": 3,
    "log_level": "INFO",
    # --- Network Settings ---
    "proxy_enabled": False,
    "proxy_url": "socks5://127.0.0.1:1080",
    # --- yt-dlp download parameters ---
    "use_aria2": False,
    "limit_rate": "0",
    "save_thumbnail": True,
    "embed_thumbnail": True,
    "embed_chapters": True,
    "embed_subtitles": False,
    # --- Application UI behavior ---
    "auto_download_after_analyse": False,
    # --- MODIFICATION START ---
    # --- Batch Download Settings ---
    "batch_download_quality": "1080p",  # Default quality for batch downloads
    "batch_download_format": "mp4",  # Default format for batch downloads
    # --- MODIFICATION END ---
}


class Config:
    """
    Application-wide dynamic configuration manager.

    This class is responsible for loading, managing, updating, and persisting all user
    settings from the config.yaml file. It is designed as a singleton and should be
    accessed globally via get_config().
    """

    def __init__(self):
        """
        Initializes the configuration object.
        It immediately attempts to load config.yaml; if that fails, a new default file is created.
        """
        # --- Base path setup ---
        self.BASE_DIR = Path(__file__).resolve().parent.parent
        self.CONFIG_PATH = self.BASE_DIR / "config.yaml"
        self.COOKIES_PATH = self.BASE_DIR / "cookies.txt"

        self._load_or_create_config()

        # --- Dynamic setting of key directories and paths ---
        if self.downloads_dir is None or not str(self.downloads_dir).strip():
            default_path = self.BASE_DIR / "downloads"
            self.DOWNLOADS_DIR = default_path
            self.downloads_dir = str(default_path)
        else:
            user_path = Path(self.downloads_dir).expanduser().resolve()
            self.DOWNLOADS_DIR = user_path
            self.downloads_dir = str(user_path)

        self.DOWNLOADS_DIR.mkdir(exist_ok=True, parents=True)

        self.LOG_DIR = self.BASE_DIR / "logs"
        self.LOG_DIR.mkdir(exist_ok=True)
        self.LOG_FILE = self.LOG_DIR / "app.log"

        self.YTDLP_DEFAULT_OUTTMPL = str(self.DOWNLOADS_DIR / "%(title)s.%(ext)s")

    def _load_or_create_config(self):
        """
        Loads the config.yaml file. If the file does not exist, a new one is created
        with default settings. If the file exists but is corrupted, the default
        configuration is used and an error is logged.
        """
        if not self.CONFIG_PATH.exists():
            logger.info(
                f"Configuration file '{self.CONFIG_PATH.name}' not found; creating a default one."
            )
            config_to_save = copy.deepcopy(DEFAULT_CONFIG)

            if config_to_save["downloads_dir"] is None:
                config_to_save["downloads_dir"] = str(self.BASE_DIR / "downloads")

            try:
                with open(self.CONFIG_PATH, "w", encoding="utf-8") as f:
                    yaml.dump(config_to_save, f, allow_unicode=True, sort_keys=False)
                user_config = config_to_save
            except IOError as e:
                logger.error(f"Unable to create configuration file: {e}", exc_info=True)
                user_config = copy.deepcopy(DEFAULT_CONFIG)

        else:
            logger.info(f"Loading configuration from '{self.CONFIG_PATH}'.")
            try:
                with open(self.CONFIG_PATH, "r", encoding="utf-8") as f:
                    user_config = yaml.safe_load(f)
                    if not isinstance(user_config, dict):
                        raise yaml.YAMLError(
                            "Configuration file root must be a mapping (dictionary)."
                        )
            except (IOError, yaml.YAMLError) as e:
                logger.error(
                    f"Failed to load or parse configuration file: {e}", exc_info=True
                )
                logger.warning("Continuing with default configuration.")
                user_config = copy.deepcopy(DEFAULT_CONFIG)

        for key, default_value in DEFAULT_CONFIG.items():
            setattr(self, key, user_config.get(key, default_value))

    def to_dict(self) -> Dict[str, Any]:
        """Returns the current configuration as a dictionary, useful for API responses or file storage."""
        return {key: getattr(self, key, None) for key in DEFAULT_CONFIG.keys()}

    def update(self, new_config: Dict[str, Any]):
        """
        Updates configuration items with a new dictionary and immediately persists
        the changes to config.yaml.
        """
        logger.debug(f"Updating configuration: {new_config}")
        for key, value in new_config.items():
            if key in DEFAULT_CONFIG:
                setattr(self, key, value)
            else:
                logger.warning(
                    f"Ignoring attempt to update undefined configuration key '{key}'."
                )
        self.save()

    def save(self):
        """Persists the current state of all configuration items back to config.yaml."""
        logger.info(f"Saving configuration to '{self.CONFIG_PATH.name}'")
        try:
            with open(self.CONFIG_PATH, "w", encoding="utf-8") as f:
                yaml.dump(self.to_dict(), f, allow_unicode=True, sort_keys=False)
        except IOError as e:
            logger.error(f"Failed to save configuration file: {e}", exc_info=True)


_config_instance: Optional[Config] = None


def get_config() -> Config:
    """Returns the global singleton configuration object instance."""
    global _config_instance
    if _config_instance is None:
        _config_instance = Config()
    return _config_instance