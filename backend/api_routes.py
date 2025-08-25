# backend/api_routes.py

import logging
# 关键修正: 导入 g 对象和 current_app
from flask import Blueprint, request, jsonify, g, current_app

api_bp = Blueprint('api', __name__, url_prefix='/api')

# 关键修正: 移除所有全局变量和 init_routes 函数

@api_bp.route('/status', methods=['GET'])
def get_status():
    # g.tasks 是由 app.py 注入的
    return jsonify({
        'status': 'running',
        'downloads_dir': str(current_app.config['CFG'].DOWNLOADS_DIR),
        'active_downloads': g.tasks.get_active_downloads_count()
    })

@api_bp.route('/info', methods=['POST'])
def get_video_info():
    try:
        url = request.get_json()['url'].strip()
        # g.downloader 是由 app.py 注入的
        info = g.downloader.get_video_info(url)
        return jsonify({'success': True, 'info': info})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@api_bp.route('/download', methods=['POST'])
def start_download():
    try:
        # 通过 Flask 的 current_app 获取配置
        config = current_app.config['CFG']
        if g.tasks.get_active_downloads_count() >= config.MAX_CONCURRENT_DOWNLOADS:
            return jsonify({'success': False, 'error': '并发下载达到上限'}), 429
            
        data = request.get_json()
        task_id = g.tasks.create_download_task(
            url=data['url'].strip(),
            user_options=data.get('options', {}),
            downloader=g.downloader
        )
        return jsonify({'success': True, 'task_id': task_id})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@api_bp.route('/progress/<task_id>', methods=['GET'])
def get_download_progress(task_id: str):
    status = g.tasks.get_task_status(task_id)
    if not status:
        return jsonify({'error': '任务不存在'}), 404
    return jsonify(status)

@api_bp.route('/downloads', methods=['GET'])
def get_downloads():
    files = g.downloader.get_download_history()
    return jsonify({'success': True, 'files': files})

@api_bp.route('/delete', methods=['POST'])
def delete_file():
    try:
        filename = request.get_json()['filename']
        g.downloader.delete_file(filename)
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500