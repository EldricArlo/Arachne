# backend/api_routes.py

import logging
from flask import Blueprint, request, jsonify, g, current_app
from yt_dlp.utils import DownloadError # Import yt-dlp's specific exception for more precise error handling

# Create a Flask Blueprint.
# Blueprints allow us to organize route definitions into multiple files
# instead of piling everything into app.py.
api_bp = Blueprint('api', __name__, url_prefix='/api')
logger = logging.getLogger(__name__)

@api_bp.route('/status', methods=['GET'])
def get_status():
    """Provides a health check endpoint for the backend service."""
    config = current_app.config['CFG']
    return jsonify({
        'status': 'running',
        'downloads_dir': str(config.DOWNLOADS_DIR),
        'active_downloads': g.tasks.get_active_downloads_count()
    })

# --- Configuration Management API ---

@api_bp.route('/config', methods=['GET'])
def get_app_config():
    """Gets the complete current application configuration."""
    logger.debug("Received request to get configuration /config GET")
    try:
        config = current_app.config['CFG']
        return jsonify({'success': True, 'config': config.to_dict()})
    except Exception as e:
        logger.error(f"Error in route /config GET: {e}", exc_info=True)
        return jsonify({'success': False, 'error': 'An internal error occurred while fetching the configuration.'}), 500

@api_bp.route('/config', methods=['POST'])
def update_app_config():
    """Updates the application configuration and saves it to config.yaml."""
    logger.debug("Received request to update configuration /config POST")
    try:
        new_config_data = request.get_json()
        if not new_config_data:
            return jsonify({'success': False, 'error': 'No configuration data provided in the request body.'}), 400
            
        config = current_app.config['CFG']
        config.update(new_config_data)
        logger.info("Application configuration has been successfully updated and saved.")
        return jsonify({'success': True, 'message': 'Configuration has been successfully updated and saved.'})
    except Exception as e:
        logger.error(f"Error in route /config POST: {e}", exc_info=True)
        return jsonify({'success': False, 'error': 'An internal error occurred while updating the configuration.'}), 500

# --- Core Business APIs ---

@api_bp.route('/info', methods=['POST'])
def get_video_info():
    """Gets video information based on a URL."""
    data = request.get_json()
    if not data or 'url' not in data:
        return jsonify({'success': False, 'error': 'Invalid request body.'}), 400
        
    url = data.get('url', '').strip()
    logger.info(f"Received request to get video info /info: {url}")

    if not url:
        return jsonify({'success': False, 'error': 'URL cannot be empty.'}), 400

    try:
        # Access the downloader instance injected via the g object before the request
        info = g.downloader.get_video_info(url)
        return jsonify({'success': True, 'info': info})
    except DownloadError as e:
        # Optimization: Specifically catch yt-dlp's download errors (usually user input issues)
        logger.warning(f"Failed to get video info (DownloadError): {e}")
        # Try to extract a cleaner, more user-friendly part from the complex error message
        error_msg = str(e).split(':')[-1].strip().replace('ERROR: ', '')
        return jsonify({'success': False, 'error': f'Could not process this URL: {error_msg}'}), 400
    except Exception as e:
        # Fallback for all other internal server errors
        logger.error(f"Unexpected error in route /info: {e}", exc_info=True)
        return jsonify({'success': False, 'error': 'An internal error occurred while fetching video info, please check logs.'}), 500

@api_bp.route('/download', methods=['POST'])
def start_download():
    """Starts a new download task."""
    data = request.get_json()
    if not data or 'url' not in data:
        return jsonify({'success': False, 'error': 'Invalid request body.'}), 400
        
    url = data.get('url', '').strip()
    logger.info(f"Received download request /download: {url}")

    if not url:
        return jsonify({'success': False, 'error': 'URL cannot be empty.'}), 400

    try:
        config = current_app.config['CFG']
        
        # Check concurrent download limit
        if g.tasks.get_active_downloads_count() >= config.max_concurrent_downloads:
            logger.warning("Download request rejected: concurrent download limit reached.")
            return jsonify({'success': False, 'error': 'Concurrent download limit reached, please try again later.'}), 429 # 429 Too Many Requests
            
        task_id = g.tasks.create_download_task(
            url=url,
            user_options=data.get('options', {}),
            downloader=g.downloader # Pass the downloader instance
        )
        logger.info(f"Successfully created download task, Task ID: {task_id}")
        return jsonify({'success': True, 'task_id': task_id}), 201 # 201 Created
    except Exception as e:
        logger.error(f"Unexpected error in route /download: {e}", exc_info=True)
        return jsonify({'success': False, 'error': 'An internal error occurred while starting the download task, please check logs.'}), 500

@api_bp.route('/progress/<task_id>', methods=['GET'])
def get_download_progress(task_id: str):
    """Gets the download progress for a specific task."""
    logger.debug(f"Querying task progress /progress/{task_id}")
    status = g.tasks.get_task_status(task_id)
    if not status:
        return jsonify({'status': 'not_found', 'error': 'Task does not exist or has expired'}), 404
    return jsonify(status)

@api_bp.route('/downloads', methods=['GET'])
def get_downloads():
    """Gets the list of downloaded history files."""
    logger.debug("Received request to get download history /downloads")
    files = g.downloader.get_download_history()
    return jsonify({'success': True, 'files': files})

@api_bp.route('/delete', methods=['POST'])
def delete_file():
    """Deletes a downloaded file."""
    data = request.get_json()
    if not data or 'filename' not in data:
        return jsonify({'success': False, 'error': 'Invalid request body.'}), 400
        
    filename = data.get('filename')
    logger.info(f"Received request to delete file /delete: {filename}")
    
    if not filename:
        return jsonify({'success': False, 'error': 'Filename cannot be empty.'}), 400
        
    try:
        g.downloader.delete_file(filename)
        return jsonify({'success': True, 'message': 'File has been deleted.'})
    except PermissionError as e:
        logger.error(f"Permission denied while deleting file: {e}", exc_info=False)
        return jsonify({'success': False, 'error': str(e)}), 403 # 403 Forbidden
    except Exception as e:
        logger.error(f"Unexpected error in route /delete: {e}", exc_info=True)
        return jsonify({'success': False, 'error': 'An internal error occurred while deleting the file, please check logs.'}), 500