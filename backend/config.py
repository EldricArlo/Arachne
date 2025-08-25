# backend/config.py

from pathlib import Path
from typing import Optional

class Config:
    """
    应用程序的基础配置类。
    
    该类集中管理所有配置项，如目录路径、并发设置和日志格式，
    使得配置的修改和访问更加方便和统一。
    """
    
    def __init__(self, downloads_dir: Optional[Path] = None):
        """
        初始化配置。

        Args:
            downloads_dir (Optional[Path]): 外部传入的下载目录路径。
                                             如果为 None，则使用默认路径。
        """
        # --- 基础路径设置 ---
        # 项目根目录，即 backend 目录的父目录
        self.BASE_DIR = Path(__file__).resolve().parent.parent
        
        # --- 下载目录设置 ---
        # 优先使用从命令行传入的下载路径，这在 Electron 集成时特别有用。
        # 否则，使用项目根目录下的 'downloads' 文件夹作为默认路径。
        if downloads_dir and isinstance(downloads_dir, Path):
            self.DOWNLOADS_DIR = downloads_dir
        else:
            self.DOWNLOADS_DIR = self.BASE_DIR / 'downloads'
        
        # 确保下载目录存在，如果不存在则创建
        self.DOWNLOADS_DIR.mkdir(exist_ok=True, parents=True)

        # --- 下载逻辑设置 ---
        # 最大并发下载数，防止过多任务同时进行导致系统资源耗尽
        self.MAX_CONCURRENT_DOWNLOADS = 3
        
        # --- 日志配置 ---
        self.LOG_DIR = self.BASE_DIR / 'logs'
        self.LOG_DIR.mkdir(exist_ok=True)
        self.LOG_FILE = self.LOG_DIR / 'app.log'
        self.LOG_LEVEL = 'INFO'
        self.LOG_FORMAT = '%(asctime)s - %(name)s - %(levelname)s - %(message)s'

        # --- yt-dlp 默认输出模板 ---
        # 定义了下载文件的默认命名格式和保存位置。
        # %(title)s 和 %(ext)s 是 yt-dlp 的模板变量。
        self.YTDLP_DEFAULT_OUTTMPL = str(self.DOWNLOADS_DIR / '%(title)s.%(ext)s')

# 全局单例实例，确保整个应用中只有一个 Config 对象
_config_instance: Optional[Config] = None

def get_config(downloads_dir: Optional[Path] = None) -> Config:
    """
    获取单例的配置对象。
    
    使用单例模式确保在应用的任何地方获取到的都是同一个配置实例。
    第一次调用时会创建实例，后续调用则直接返回已创建的实例。

    Args:
        downloads_dir (Optional[Path]): 首次初始化时可以传入的下载目录。

    Returns:
        Config: 配置类的单例实例。
    """
    global _config_instance
    if _config_instance is None:
        _config_instance = Config(downloads_dir)
    return _config_instance
