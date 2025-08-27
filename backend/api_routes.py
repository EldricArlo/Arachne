# backend/api_routes.py

import logging
import re
from flask import Blueprint, request, jsonify, g, current_app
from yt_dlp.utils import (
    DownloadError,
)

# 创建一个 Flask 蓝图，用于组织和注册所有与 API 相关的路由。
# url_prefix='/api' 意味着此蓝图中定义的所有路由都会自动以 /api 开头。
api_bp = Blueprint("api", __name__, url_prefix="/api")
logger = logging.getLogger(__name__)


def _extract_url_from_text(text: str) -> str:
    """
    从给定的文本字符串中提取第一个找到的有效 URL。
    """
    if not text:
        return ""
    # 【优化】使用一个更健壮的正则表达式来捕获URL，能更好地处理尾部包含特殊字符的情况。
    match = re.search(r'https?://(?:[a-zA-Z]|[0-9]|[$-_@.&+]|[!*\\(\\),]|(?:%[0-9a-fA-F][0-9a-fA-F]))+', text)
    if match:
        url = match.group(0)
        logger.info(f"从文本中提取到 URL: {url}")
        return url
    logger.warning(f"无法从文本中提取有效 URL: {text}")
    return ""


@api_bp.route("/status", methods=["GET"])
def get_status():
    """
    一个简单的状态检查端点，返回后端服务的当前状态。
    """
    config = current_app.config["CFG"]
    return jsonify(
        {
            "success": True,
            "status": "running",
            "downloads_dir": str(config.DOWNLOADS_DIR),
            "active_downloads": g.tasks.get_active_downloads_count(),
        }
    )


# --- 配置管理 API ---

@api_bp.route("/config", methods=["GET"])
def get_app_config():
    """
    获取当前应用的完整配置信息。
    """
    logger.debug("Received request to get configuration /config GET")
    try:
        config = current_app.config["CFG"]
        return jsonify({"success": True, "config": config.to_dict()})
    except Exception as e:
        logger.error(f"Error in route /config GET: {e}", exc_info=True)
        return jsonify({"success": False, "error": "An internal error occurred."}), 500


@api_bp.route("/config", methods=["POST"])
def update_app_config():
    """
    接收前端发送的新配置数据，并更新 config.yaml 文件。
    """
    logger.debug("Received request to update configuration /config POST")
    try:
        new_config_data = request.get_json()
        if not new_config_data:
            return jsonify({"success": False, "error": "No data provided."}), 400

        config = current_app.config["CFG"]
        config.update(new_config_data)
        logger.info("Application configuration updated and saved.")
        return jsonify({"success": True, "message": "Configuration updated."})
    except Exception as e:
        logger.error(f"Error in route /config POST: {e}", exc_info=True)
        return jsonify({"success": False, "error": "An internal error occurred."}), 500


# --- Cookie 管理 API ---

@api_bp.route("/cookies", methods=["GET"])
def get_cookies():
    """
    读取并返回 cookies.txt 文件的内容。
    """
    logger.debug("Received request to get cookies /cookies GET")
    try:
        config = current_app.config["CFG"]
        cookies_path = config.COOKIES_PATH
        cookie_content = ""
        if cookies_path.exists() and cookies_path.is_file():
            with open(cookies_path, "r", encoding="utf-8") as f:
                cookie_content = f.read()
        return jsonify({"success": True, "cookies": cookie_content})
    except Exception as e:
        logger.error(f"Error in route /cookies GET: {e}", exc_info=True)
        return jsonify({"success": False, "error": "An internal error occurred."}), 500


@api_bp.route("/cookies", methods=["POST"])
def update_cookies():
    """
    接收前端发送的 Cookie 字符串，并将其写入 cookies.txt 文件。
    """
    logger.debug("Received request to update cookies /cookies POST")
    try:
        data = request.get_json()
        if data is None or "cookies" not in data:
            return jsonify({"success": False, "error": "No cookie data provided."}), 400

        config = current_app.config["CFG"]
        with open(config.COOKIES_PATH, "w", encoding="utf-8") as f:
            f.write(data.get("cookies", ""))
        logger.info("Cookies file updated.")
        return jsonify({"success": True, "message": "Cookies saved."})
    except Exception as e:
        logger.error(f"Error in route /cookies POST: {e}", exc_info=True)
        return jsonify({"success": False, "error": "An internal error occurred."}), 500


# --- 核心业务 API ---

@api_bp.route("/info", methods=["POST"])
def get_video_info():
    """
    接收一个 URL，调用 yt-dlp 获取视频的元数据（标题、时长等）。
    """
    data = request.get_json()
    if not data or "url" not in data:
        return jsonify({"success": False, "error": "Invalid request."}), 400

    url = _extract_url_from_text(data.get("url", "").strip())
    if not url:
        return jsonify({"success": False, "error": "No valid URL found."}), 400

    try:
        info = g.downloader.get_video_info(url)
        return jsonify({"success": True, "info": info})
    except DownloadError as e:
        error_msg = str(e).split(":")[-1].strip().replace("ERROR: ", "")
        logger.warning(f"Failed to get video info for '{url}': {error_msg}")
        return jsonify({"success": False, "error": f"URL error: {error_msg}"}), 400
    except Exception as e:
        logger.error(f"Unexpected error in route /info for '{url}': {e}", exc_info=True)
        return jsonify({"success": False, "error": "An internal server error occurred."}), 500


@api_bp.route("/download", methods=["POST"])
def start_download():
    """
    接收一个 URL 和下载选项，创建一个新的后台下载任务。
    """
    data = request.get_json()
    if not data or "url" not in data:
        return jsonify({"success": False, "error": "Invalid request."}), 400

    url = _extract_url_from_text(data.get("url", "").strip())
    if not url:
        return jsonify({"success": False, "error": "No valid URL found."}), 400

    try:
        config = current_app.config["CFG"]
        # --- MODIFICATION START ---
        # 核心修正：在进行比较之前，使用 int() 将配置值强制转换为整数。
        # 这可以防止因配置文件中的值为字符串（如 "3"）而导致的 TypeError。
        if g.tasks.get_active_downloads_count() >= int(config.max_concurrent_downloads):
        # --- MODIFICATION END ---
            return jsonify({"success": False, "error": "Concurrent download limit reached."}), 429

        task_id = g.tasks.create_download_task(
            url=url,
            user_options=data.get("options", {}),
            downloader=g.downloader,
        )
        logger.info(f"Created download task, ID: {task_id}")
        return jsonify({"success": True, "task_id": task_id}), 201
    except Exception as e:
        logger.error(f"Unexpected error in route /download for '{url}': {e}", exc_info=True)
        return jsonify({"success": False, "error": "An internal server error occurred."}), 500


# --- MODIFICATION START ---
@api_bp.route("/batch-download", methods=["POST"])
def start_batch_download():
    """
    【修正】接收一个 URL 列表，为其创建下载任务，并返回包含所有任务ID的列表。
    """
    data = request.get_json()
    if not data or not isinstance(data.get("urls"), list) or not data["urls"]:
        return jsonify({"success": False, "error": "A non-empty list of URLs is required."}), 400

    urls_to_process = data["urls"]
    logger.info(f"Received batch download request for {len(urls_to_process)} URLs.")

    try:
        config = current_app.config["CFG"]
        user_options = {
            "quality": config.batch_download_quality,
            "format": config.batch_download_format,
            "audioOnly": False
        }

        created_task_details = []  # 存储成功创建的任务信息 (id, url)
        skipped_tasks = 0
        
        for raw_url in urls_to_process:
            # --- MODIFICATION START ---
            # 同样在这里应用类型转换修正
            if g.tasks.get_active_downloads_count() >= int(config.max_concurrent_downloads):
            # --- MODIFICATION END ---
                logger.warning(f"Concurrent download limit ({config.max_concurrent_downloads}) reached. Skipping remaining URLs.")
                skipped_tasks = len(urls_to_process) - len(created_task_details)
                break

            url = _extract_url_from_text(raw_url.strip())
            if url:
                task_id = g.tasks.create_download_task(
                    url=url,
                    user_options=user_options,
                    downloader=g.downloader
                )
                created_task_details.append({"task_id": task_id, "url": url})

        message = f"Successfully added {len(created_task_details)} tasks to the queue."
        if skipped_tasks > 0:
            message += f" {skipped_tasks} tasks were skipped as the concurrent download limit was reached."

        logger.info(message)
        # 【核心修改】返回包含任务ID的详细列表，而不仅仅是消息
        return jsonify({
            "success": True, 
            "message": message,
            "created_tasks": created_task_details
        }), 201

    except Exception as e:
        logger.error(f"Unexpected error in route /batch-download: {e}", exc_info=True)
        return jsonify({"success": False, "error": "An internal error occurred."}), 500
# --- MODIFICATION END ---


@api_bp.route("/progress/<task_id>", methods=["GET"])
def get_download_progress(task_id: str):
    """
    根据任务ID，获取特定下载任务的当前进度和状态。
    这个端点会被前端高频轮询。
    """
    status = g.tasks.get_task_status(task_id)
    if not status:
        return jsonify({"status": "not_found", "error": "Task not found."}), 404
    # 注意：这里不使用 success 字段，因为前端需要直接处理 status 字段，即使是 'not_found'。
    return jsonify(status)


@api_bp.route("/downloads", methods=["GET"])
def get_downloads():
    """
    扫描下载目录，返回所有已完成文件的列表。
    """
    logger.debug("Received request to get download history /downloads")
    try:
        files = g.downloader.get_download_history()
        return jsonify({"success": True, "files": files})
    except Exception as e:
        logger.error(f"Error in route /downloads: {e}", exc_info=True)
        return jsonify({"success": False, "error": "Failed to retrieve download history."}), 500


@api_bp.route("/delete", methods=["POST"])
def delete_file():
    """
    接收文件名，并从下载目录中删除对应文件。
    """
    data = request.get_json()
    if not data or "filename" not in data:
        return jsonify({"success": False, "error": "Invalid request."}), 400

    filename = data.get("filename")
    if not filename:
        return jsonify({"success": False, "error": "Filename cannot be empty."}), 400

    logger.info(f"Received request to delete file: {filename}")
    try:
        g.downloader.delete_file(filename)
        return jsonify({"success": True, "message": "File deleted."})
    except FileNotFoundError:
        return jsonify({"success": False, "error": "File not found."}), 404
    except PermissionError as e:
        return jsonify({"success": False, "error": str(e)}), 403
    except Exception as e:
        logger.error(f"Unexpected error in route /delete: {e}", exc_info=True)
        return jsonify({"success": False, "error": "An internal server error occurred."}), 500