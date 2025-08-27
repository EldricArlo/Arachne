# backend/app.py

import sys
from pathlib import Path

# --- Critical fix: ensure the project root is in Python's module search path ---
# This resolves issues where 'import backend.xxx' fails in different environments.
BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.append(str(BASE_DIR))

import logging
import argparse
from flask import Flask, jsonify, g
from flask_cors import CORS

# --- Modular imports ---
# Import necessary components from other project modules
from backend.config import get_config, Config
from backend.api_routes import api_bp
from backend.downloader import YouTubeDownloader
from backend import tasks


def create_app(config: Config) -> Flask:
    """
    Application factory function.

    Responsible for creating and configuring the Flask application instance.
    This pattern makes the creation process more flexible, easier to test, and extensible.

    Args:
        config (Config): Application configuration object loaded from config.py.

    Returns:
        Flask: Fully configured Flask application instance.
    """
    app = Flask(__name__)

    # Configure CORS to allow cross-origin requests to /api/* from any origin,
    # which is necessary for Electron apps
    CORS(app, resources={r"/api/*": {"origins": "*"}})

    # Store the global config object in Flask's app.config for easy access
    app.config["CFG"] = config

    # Create a singleton Downloader instance shared across the app's lifecycle
    downloader = YouTubeDownloader(config)

    @app.before_request
    def before_request_func():
        """
        Before-request hook.

        Called before handling each incoming request.
        Here we inject core service instances (e.g., downloader and tasks)
        into Flask's global context object `g`. This allows route functions
        to access these instances via `g.downloader` without global variables
        or repeated instantiation.
        """
        g.downloader = downloader
        g.tasks = tasks

    # Register the API blueprint to apply all routes defined in api_routes.py
    app.register_blueprint(api_bp)

    @app.route("/")
    def health_check():
        """
        Health-check endpoint at the root path.

        Used to confirm the backend service is running.
        """
        return jsonify({"status": "running", "message": "Video Downloader Backend"})

    return app


def setup_logging(config: Config):
    """
    Configure the application's logging system.

    Outputs logs to both file and console, setting the log level
    based on the configuration file.

    Args:
        config (Config): Application configuration object.
    """
    log_level_str = config.log_level.upper()
    log_level = getattr(logging, log_level_str, logging.INFO)

    # Ensure the log directory exists, creating it if necessary
    config.LOG_DIR.mkdir(exist_ok=True)

    # Configure basic logging settings
    logging.basicConfig(
        level=log_level,
        # Log format: time - logger name - level - [thread name] - message
        format="%(asctime)s - %(name)s - %(levelname)s - [%(threadName)s] - %(message)s",
        handlers=[
            # File handler: write logs to app.log with UTF-8 encoding
            logging.FileHandler(config.LOG_FILE, encoding="utf-8"),
            # Stream handler: output logs to console (stdout/stderr)
            logging.StreamHandler(),
        ],
        force=True,  # Force reconfiguration to avoid conflicts in environments like pytest
    )
    # Filter out noisy logs from third-party libraries to keep output clean
    logging.getLogger("werkzeug").setLevel(logging.WARNING)
    logging.getLogger("urllib3").setLevel(logging.WARNING)


def main():
    """
    Main function to start the backend server directly.

    Responsible for parsing command-line arguments (especially port number),
    loading configuration, setting up logging, and finally running the Flask app.
    """
    parser = argparse.ArgumentParser(description="Video Downloader Backend Server")
    parser.add_argument(
        "--port", type=int, default=5000, help="Port to run the Flask web server on."
    )
    args = parser.parse_args()

    # 1. Load or create config.yaml
    config = get_config()

    # 2. Set up logging based on loaded configuration
    setup_logging(config)
    logger = logging.getLogger(__name__)

    # 3. Create the Flask app instance
    app = create_app(config)

    # 4. Get host and port from command-line arguments or defaults
    host = "127.0.0.1"
    port = args.port

    # --- Print clear startup information ---
    logger.info("=" * 50)
    logger.info("Video Downloader backend service is starting")
    logger.info(f"Config file: {config.CONFIG_PATH}")
    logger.info(f"Download directory: {config.DOWNLOADS_DIR}")
    logger.info(f"Log level: {config.log_level.upper()}")
    logger.info(f"Service will listen on: http://{host}:{port}")
    logger.info("=" * 50)

    # --- MODIFICATION START ---
    # Print our custom, reliable signal to stdout.
    # The `flush=True` is critical to ensure the output is not buffered and is
    # immediately sent to the parent process (electron/python-manager.js).
    print("BACKEND_READY_SIGNAL", flush=True)
    # --- MODIFICATION END ---

    # 5. Start the Flask service
    # Debug must be False in production/packaged environments to avoid dual-process issues
    app.run(host=host, port=port, debug=False)


if __name__ == "__main__":
    # Run the main function when this file is executed directly
    main()