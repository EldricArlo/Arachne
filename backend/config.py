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
    'downloads_dir': None,  # Special value None: will be dynamically resolved at runtime to 'project_root/downloads'

    # --- Performance & Behavior ---
    'max_concurrent_downloads': 3,
    'log_level': 'INFO',    # Allowed: DEBUG, INFO, WARNING, ERROR

    # --- Network Settings ---
    'proxy_enabled': False,
    'proxy_url': 'socks5://127.0.0.1:1080',

    # --- yt-dlp download parameters ---
    'use_aria2': False,
    'limit_rate': '0',      # Download rate limit; '0' means unlimited (e.g. '50K', '4.2M')
    'save_thumbnail': True, # Whether to save the thumbnail as a separate .jpg file
    'embed_thumbnail': True,  # Whether to embed the thumbnail into the media file (requires save_thumbnail=True)
    'embed_chapters': True,   # Whether to embed video chapter information
    'embed_subtitles': False, # Whether to embed subtitles

    # --- Application UI behavior ---
    'auto_download_after_analyse': False,  # Whether to start downloading automatically after fetching info
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
        # self.BASE_DIR points to the project root (backend/../)
        self.BASE_DIR = Path(__file__).resolve().parent.parent
        self.CONFIG_PATH = self.BASE_DIR / 'config.yaml'

        # Load or create the configuration and set every item as an attribute of the class
        self._load_or_create_config()

        # --- Dynamic setting of key directories and paths ---
        # If the user did not specify a downloads directory in config.yaml, use the default
        if self.downloads_dir is None or not str(self.downloads_dir).strip():
            self.DOWNLOADS_DIR = self.BASE_DIR / 'downloads'
            # Also update the dynamically determined default back into the attribute
            # for persistence and display in the UI
            self.downloads_dir = str(self.DOWNLOADS_DIR)
        else:
            # Otherwise, use the path provided by the user
            self.DOWNLOADS_DIR = Path(self.downloads_dir)

        # Ensure the downloads directory exists regardless of its source
        self.DOWNLOADS_DIR.mkdir(exist_ok=True, parents=True)

        # Define and create the log directory
        self.LOG_DIR = self.BASE_DIR / 'logs'
        self.LOG_DIR.mkdir(exist_ok=True)
        self.LOG_FILE = self.LOG_DIR / 'app.log'

        # Default yt-dlp single-file output path template
        self.YTDLP_DEFAULT_OUTTMPL = str(self.DOWNLOADS_DIR / '%(title)s.%(ext)s')

    def _load_or_create_config(self):
        """
        Loads the config.yaml file. If the file does not exist, a new one is created
        with default settings. If the file exists but is corrupted, the default
        configuration is used and an error is logged.
        """
        if not self.CONFIG_PATH.exists():
            logger.info(f"Configuration file '{self.CONFIG_PATH.name}' not found; creating a default one.")
            # Deep-copy the default configuration to avoid accidentally mutating the original dict
            config_to_save = copy.deepcopy(DEFAULT_CONFIG)

            # Intelligently set the default download path
            if config_to_save['downloads_dir'] is None:
                config_to_save['downloads_dir'] = str(self.BASE_DIR / 'downloads')

            try:
                with open(self.CONFIG_PATH, 'w', encoding='utf-8') as f:
                    yaml.dump(config_to_save, f, allow_unicode=True, sort_keys=False)
                user_config = config_to_save
            except IOError as e:
                logger.error(f"Unable to create configuration file: {e}", exc_info=True)
                user_config = copy.deepcopy(DEFAULT_CONFIG)  # Fall back to in-memory defaults

        else:
            logger.info(f"Loading configuration from '{self.CONFIG_PATH}'.")
            try:
                with open(self.CONFIG_PATH, 'r', encoding='utf-8') as f:
                    user_config = yaml.safe_load(f)
                    if not isinstance(user_config, dict):  # Ensure the root is a dictionary
                        raise yaml.YAMLError("Configuration file root must be a mapping (dictionary).")
            except (IOError, yaml.YAMLError) as e:
                logger.error(f"Failed to load or parse configuration file: {e}", exc_info=True)
                logger.warning("Continuing with default configuration.")
                user_config = copy.deepcopy(DEFAULT_CONFIG)

        # Safely set every loaded key as a class attribute; fall back to defaults for missing keys
        for key, default_value in DEFAULT_CONFIG.items():
            setattr(self, key, user_config.get(key, default_value))

    def to_dict(self) -> Dict[str, Any]:
        """Returns the current configuration as a dictionary, useful for API responses or file storage."""
        # Use a dict comprehension; only include keys defined in DEFAULT_CONFIG
        return {key: getattr(self, key, None) for key in DEFAULT_CONFIG.keys()}

    def update(self, new_config: Dict[str, Any]):
        """
        Updates configuration items with a new dictionary and immediately persists
        the changes to config.yaml.

        Args:
            new_config (Dict[str, Any]): A dictionary of key-value pairs to update.
        """
        logger.debug(f"Updating configuration: {new_config}")
        for key, value in new_config.items():
            # Security: only update predefined keys from DEFAULT_CONFIG to prevent arbitrary attribute injection
            if key in DEFAULT_CONFIG:
                setattr(self, key, value)
            else:
                logger.warning(f"Ignoring attempt to update undefined configuration key '{key}'.")
        self.save()

    def save(self):
        """Persists the current state of all configuration items back to config.yaml."""
        logger.info(f"Saving configuration to '{self.CONFIG_PATH.name}'")
        try:
            with open(self.CONFIG_PATH, 'w', encoding='utf-8') as f:
                # Use self.to_dict() to obtain a clean, serializable dictionary
                yaml.dump(self.to_dict(), f, allow_unicode=True, sort_keys=False)
        except IOError as e:
            logger.error(f"Failed to save configuration file: {e}", exc_info=True)

# --- Global singleton management ---
_config_instance: Optional[Config] = None

def get_config() -> Config:
    """
    Returns the global singleton configuration object instance.

    Calling this function anywhere in the application returns the same Config instance,
    ensuring global consistency of configuration.
    """
    global _config_instance
    if _config_instance is None:
        _config_instance = Config()
    return _config_instance