# backend/api_routes.py

import logging
from flask import Blueprint, request, jsonify, g, current_app

# 创建一个蓝图实例，所有 API 路由都将注册到这个蓝图上
api_bp = Blueprint('api', __name__, url_prefix='/api')
logger = logging.getLogger(__name__)

@api_bp.route('/status', methods=['GET'])
def get_status():
    """提供后端服务的健康检查和基本信息。"""
    # g.tasks 是在 app.py 的 before_request 钩子中注入的
    return jsonify({
        'status': 'running',
        'downloads_dir': str(current_app.config['CFG'].DOWNLOADS_DIR),
        'active_downloads': g.tasks.get_active_downloads_count()
    })

@api_bp.route('/info', methods=['POST'])
def get_video_info():
    """根据 URL 获取视频信息。"""
    try:
        url = request.get_json()['url'].strip()
        # g.downloader 是在 app.py 的 before_request 钩子中注入的
        info = g.downloader.get_video_info(url)
        return jsonify({'success': True, 'info': info})
    except Exception as e:
        logger.error(f"路由 /info 出错: {e}", exc_info=True)
        return jsonify({'success': False, 'error': '获取视频信息时发生内部错误，请检查日志。'}), 500

@api_bp.route('/download', methods=['POST'])
def start_download():
    """启动一个新的下载任务。"""
    try:
        # 通过 Flask 的 current_app 获取配置
        config = current_app.config['CFG']
        
        # 检查并发限制
        if g.tasks.get_active_downloads_count() >= config.MAX_CONCURRENT_DOWNLOADS:
            return jsonify({'success': False, 'error': '并发下载达到上限'}), 429
            
        data = request.get_json()
        task_id = g.tasks.create_download_task(
            url=data['url'].strip(),
            user_options=data.get('options', {}),
            downloader=g.downloader  # 将共享的 downloader 实例传入
        )
        return jsonify({'success': True, 'task_id': task_id})
    except Exception as e:
        logger.error(f"路由 /download 出错: {e}", exc_info=True)
        return jsonify({'success': False, 'error': '启动下载任务时发生内部错误，请检查日志。'}), 500

@api_bp.route('/progress/<task_id>', methods=['GET'])
def get_download_progress(task_id: str):
    """获取指定任务的下载进度。"""
    status = g.tasks.get_task_status(task_id)
    if not status:
        return jsonify({'error': '任务不存在'}), 404
    return jsonify(status)

@api_bp.route('/downloads', methods=['GET'])
def get_downloads():
    """获取下载历史文件列表。"""
    files = g.downloader.get_download_history()
    return jsonify({'success': True, 'files': files})

@api_bp.route('/delete', methods=['POST'])
def delete_file():
    """删除一个已下载的文件。"""
    try:
        filename = request.get_json()['filename']
        g.downloader.delete_file(filename)
        return jsonify({'success': True})
    except PermissionError as e:
        logger.error(f"路由 /delete 权限错误: {e}", exc_info=True)
        return jsonify({'success': False, 'error': str(e)}), 403
    except Exception as e:
        logger.error(f"路由 /delete 出错: {e}", exc_info=True)
        return jsonify({'success': False, 'error': '删除文件时发生内部错误，请检查日志。'}), 500
