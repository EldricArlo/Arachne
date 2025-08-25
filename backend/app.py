# backend/app.py

import logging
import argparse
from pathlib import Path
from flask import Flask, jsonify, g
from flask_cors import CORS

from backend.config import get_config, Config
from backend.api_routes import api_bp
from backend.downloader import YouTubeDownloader
from backend import tasks

def create_app(config: Config) -> Flask:
    """
    应用工厂函数，用于创建和配置 Flask 应用实例。
    
    使用工厂模式可以方便地为不同的环境（如测试、开发、生产）创建不同的应用实例。
    """
    app = Flask(__name__)
    # 启用 CORS，允许来自任何源的 /api/ 路径请求，这对于 Electron 应用是安全的
    CORS(app, resources={r"/api/*": {"origins": "*"}})
    
    # 将配置对象存入 Flask app.config，使其在应用上下文中可用
    app.config['CFG'] = config
    
    # 创建一个单例的 Downloader 实例，供整个应用生命周期使用
    downloader = YouTubeDownloader(config)
    
    @app.before_request
    def before_request_func():
        """
        Flask 请求前钩子函数。
        
        在处理每个请求之前，这个函数会被调用。
        我们在这里将 downloader 实例和 tasks 模块注入到 Flask 的 g 对象中。
        g 对象是线程安全的，并且在每个请求的生命周期内唯一，
        这使得在 API 路由中可以方便地访问这些共享资源，而无需使用全局变量。
        """
        g.downloader = downloader
        g.tasks = tasks

    # 注册 API 蓝图
    app.register_blueprint(api_bp)
    
    @app.route('/')
    def health_check():
        """根路径的健康检查端点。"""
        return jsonify({'status': 'running', 'message': 'YouTube Downloader Backend'})
        
    return app

def setup_logging(config: Config):
    """配置应用的日志记录器。"""
    logging.basicConfig(
        level=config.LOG_LEVEL,
        format=config.LOG_FORMAT,
        handlers=[
            # 输出到文件
            logging.FileHandler(config.LOG_FILE, encoding='utf-8'),
            # 同时输出到控制台
            logging.StreamHandler()
        ],
        force=True  # 强制重新配置，避免在某些环境中出现问题
    )
    # 降低 werkzeug (Flask 开发服务器) 的日志级别，避免刷屏
    logging.getLogger('werkzeug').setLevel(logging.ERROR)
    logging.getLogger('urllib3').setLevel(logging.WARNING)

def main():
    """
    主函数，用于直接运行后端服务。
    
    它解析命令行参数，初始化配置和日志，然后启动 Flask 开发服务器。
    """
    parser = argparse.ArgumentParser(description='YouTube 下载器后端服务')
    parser.add_argument('--host', default='127.0.0.1', help='服务监听的主机地址')
    parser.add_argument('--port', type=int, default=5000, help='服务监听的端口')
    parser.add_argument('--downloads-dir', type=str, help='指定下载目录的绝对路径')
    
    args = parser.parse_args()
    
    # 根据命令行参数初始化配置
    downloads_path = Path(args.downloads_dir) if args.downloads_dir else None
    config = get_config(downloads_path)
    
    setup_logging(config)
    logger = logging.getLogger(__name__)

    app = create_app(config)
    
    # 打印启动信息
    logger.info("=" * 50)
    logger.info("YouTube 下载器后端服务启动")
    logger.info(f"服务地址: http://{args.host}:{args.port}")
    logger.info(f"下载目录: {config.DOWNLOADS_DIR}")
    logger.info("=" * 50)
    
    # 启动 Flask 服务
    # debug=False 在生产或类生产环境中是必须的，以避免安全风险和性能问题
    app.run(host=args.host, port=args.port, debug=False)

# 当这个文件作为主程序运行时 (__name__ == '__main__')，才执行 main() 函数
if __name__ == '__main__':
    main()
