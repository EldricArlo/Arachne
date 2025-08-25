# backend/app.py

import logging
import argparse
from pathlib import Path
# 关键修正: 导入 g
from flask import Flask, jsonify, g
from flask_cors import CORS

# 关键修正：使用直接、明确的导入
from backend.config import get_config, Config
from backend.api_routes import api_bp
from backend.downloader import YouTubeDownloader
from backend import tasks

def create_app(config: Config) -> Flask:
    """应用工厂，创建并配置 Flask 应用实例"""
    app = Flask(__name__)
    CORS(app, resources={r"/api/*": {"origins": "*"}})
    
    # 将配置对象存入 Flask 的 app.config
    # 这是一个标准的 Flask 做法
    app.config['CFG'] = config
    
    # 创建一个单例的 Downloader 实例
    downloader = YouTubeDownloader(config)
    
    # 关键修正: 使用 before_request 钩子来注入依赖
    # 这会在每个请求处理前运行
    @app.before_request
    def before_request_func():
        # 将 downloader 和 tasks 模块存入 g 对象
        # g 对象在每个请求的生命周期内都是唯一的
        g.downloader = downloader
        g.tasks = tasks

    app.register_blueprint(api_bp)
    
    @app.route('/')
    def health_check():
        return jsonify({'status': 'running', 'message': 'YouTube Downloader Backend'})
        
    return app

def setup_logging(config: Config):
    """配置日志记录器"""
    logging.basicConfig(
        level=config.LOG_LEVEL,
        format=config.LOG_FORMAT,
        handlers=[
            logging.FileHandler(config.LOG_FILE, encoding='utf-8'),
            logging.StreamHandler()
        ],
        force=True
    )
    logging.getLogger('werkzeug').setLevel(logging.ERROR)
    logging.getLogger('urllib3').setLevel(logging.WARNING)

def main():
    """主函数，解析命令行参数并启动服务"""
    parser = argparse.ArgumentParser(description='YouTube 下载器后端服务')
    parser.add_argument('--host', default='127.0.0.1', help='服务主机地址')
    parser.add_argument('--port', type=int, default=5000, help='服务端口')
    parser.add_argument('--downloads-dir', type=str, help='指定下载目录的绝对路径')
    
    args = parser.parse_args()
    
    downloads_path = Path(args.downloads_dir) if args.downloads_dir else None
    config = get_config(downloads_path)
    
    setup_logging(config)
    logger = logging.getLogger(__name__)

    app = create_app(config)
    
    logger.info("=" * 50)
    logger.info("YouTube 下载器后端服务启动")
    logger.info(f"服务地址: http://{args.host}:{args.port}")
    logger.info(f"下载目录: {config.DOWNLOADS_DIR}")
    logger.info("=" * 50)
    
    app.run(host=args.host, port=args.port, debug=False)

# 确保这个文件作为模块运行时，main()不会被执行
if __name__ == '__main__':
    main()