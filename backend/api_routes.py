# backend/api_routes.py
"""
Defines all API endpoints for the Flask application.

This module uses a Flask Blueprint to organize routes related to application
status, configuration, video information, downloads, and file management.
"""

import logging
from flask import Blueprint, current_app, g, jsonify, request
from yt_dlp.utils import DownloadError

api_bp = Blueprint("api", __name__, url_prefix="/api")
logger = logging.getLogger(__name__)


# --- Centralized Error Handling ---
@api_bp.app_errorhandler(Exception)
def handle_unexpected_error(e):
    """Global handler for all unhandled exceptions."""
    logger.error(f"An unexpected error occurred in an API route: {e}", exc_info=True)
    return jsonify({"success": False, "error": "An internal server error occurred."}), 500


@api_bp.route("/status", methods=["GET"])
def get_status():
    """Endpoint to check the health and status of the backend service."""
    config = current_app.config["CFG"]
    return jsonify(
        {
            "success": True,
            "status": "running",
            "downloads_dir": str(config.DOWNLOADS_DIR),
            "active_downloads": g.tasks.get_active_downloads_count(),
        }
    )


@api_bp.route("/config", methods=["GET"])
def get_app_config():
    """Endpoint to retrieve the current application configuration."""
    logger.debug("Received request to get configuration /config GET")
    config = current_app.config["CFG"]
    return jsonify({"success": True, "config": config.to_dict()})


@api_bp.route("/config", methods=["POST"])
def update_app_config():
    """Endpoint to update and save the application configuration."""
    logger.debug("Received request to update configuration /config POST")
    new_config_data = request.get_json()
    if not new_config_data:
        return jsonify({"success": False, "error": "No data provided."}), 400

    config = current_app.config["CFG"]
    config.update(new_config_data)
    logger.info("Application configuration updated and saved.")
    return jsonify({"success": True, "message": "Configuration updated."})


@api_bp.route("/cookies", methods=["GET"])
def get_cookies():
    """Endpoint to read and return the content of the cookies.txt file."""
    logger.debug("Received request to get cookies /cookies GET")
    config = current_app.config["CFG"]
    cookies_path = config.COOKIES_PATH
    cookie_content = ""
    if cookies_path.exists() and cookies_path.is_file():
        cookie_content = cookies_path.read_text(encoding="utf-8")
    return jsonify({"success": True, "cookies": cookie_content})


@api_bp.route("/cookies", methods=["POST"])
def update_cookies():
    """Endpoint to update the content of the cookies.txt file."""
    logger.debug("Received request to update cookies /cookies POST")
    data = request.get_json()
    if data is None or "cookies" not in data:
        return jsonify({"success": False, "error": "No cookie data provided."}), 400

    config = current_app.config["CFG"]
    config.COOKIES_PATH.write_text(data.get("cookies", ""), encoding="utf-8")
    logger.info("Cookies file updated.")
    return jsonify({"success": True, "message": "Cookies saved."})


@api_bp.route("/info", methods=["POST"])
def get_video_info():
    """Endpoint to fetch metadata for a given video URL."""
    data = request.get_json()
    if not data or "url" not in data or not data["url"].strip():
        return jsonify({"success": False, "error": "A valid URL must be provided."}), 400
    
    url = data["url"].strip()
    try:
        video_info = g.downloader.get_video_info(url)
        return jsonify({"success": True, "info": video_info})
    except DownloadError as e:
        logger.warning(f"Failed to fetch info for URL '{url}': {e}")
        return jsonify({"success": False, "error": "Failed to retrieve video information. The URL might be invalid, private, or unsupported."}), 400


@api_bp.route("/download", methods=["POST"])
def start_download():
    """Endpoint to start a single download task."""
    data = request.get_json()
    if not data or "url" not in data or "options" not in data:
        return jsonify({"success": False, "error": "URL and download options must be provided."}), 400

    url = data["url"].strip()
    options = data["options"]
    if not url:
        return jsonify({"success": False, "error": "URL cannot be empty."}), 400
    
    task_id = g.tasks.create_download_task(url, options, g.downloader)
    return jsonify({"success": True, "task_id": task_id}), 202


@api_bp.route("/batch-download", methods=["POST"])
def start_batch_download():
    """Endpoint to start multiple download tasks."""
    data = request.get_json()
    if not data or "urls" not in data or not isinstance(data["urls"], list):
        return jsonify({"success": False, "error": "A list of URLs must be provided."}), 400

    urls = [url.strip() for url in data["urls"] if url.strip()]
    if not urls:
        return jsonify({"success": False, "error": "No valid URLs were provided."}), 400

    config = current_app.config["CFG"]
    created_tasks = []
    
    # Use batch-specific default options from config
    batch_options = {
        "quality": config.batch_download_quality,
        "format": config.batch_download_format,
        "audioOnly": False
    }

    for url in urls:
        task_id = g.tasks.create_download_task(url, batch_options, g.downloader)
        created_tasks.append({"task_id": task_id, "url": url})
        
    return jsonify({
        "success": True,
        "message": f"Successfully queued {len(created_tasks)} downloads.",
        "created_tasks": created_tasks,
    }), 202


@api_bp.route("/progress/<task_id>", methods=["GET"])
def get_task_progress(task_id: str):
    """Endpoint to check the progress of a specific download task."""
    status = g.tasks.get_task_status(task_id)
    if not status:
        return jsonify({"success": False, "status": "not_found"}), 404
    
    response = {"success": True, **status}
    return jsonify(response)


@api_bp.route("/downloads", methods=["GET"])
def get_download_history():
    """Endpoint to get the list of downloaded files."""
    files = g.downloader.get_download_history()
    return jsonify({"success": True, "files": files})


@api_bp.route("/delete", methods=["POST"])
def delete_downloaded_file():
    """Endpoint to delete a specific file from the downloads folder."""
    data = request.get_json()
    if not data or "filename" not in data or not data["filename"].strip():
        return jsonify({"success": False, "error": "A valid filename must be provided."}), 400

    filename = data["filename"]
    try:
        g.downloader.delete_file(filename)
        return jsonify({"success": True, "message": f"File '{filename}' deleted."})
    except FileNotFoundError:
        return jsonify({"success": False, "error": "File not found."}), 404
    except PermissionError as e:
        logger.warning(f"Permission denied while trying to delete '{filename}': {e}")
        return jsonify({"success": False, "error": str(e)}), 403