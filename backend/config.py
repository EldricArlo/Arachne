# backend/config.py

from pathlib import Path
# 关键修正: 导入 Optional 用于正确的类型提示
from typing import Optional

class Config:
    """应用程序的基础配置类"""
    
    # 关键修正: 使用 Optional[Path] 来正确提示可选参数
    def __init__(self, downloads_dir: Optional[Path] = None):
        # 项目根目录
        self.BASE_DIR = Path(__file__).parent.parent
        
        # 优先使用从命令行传入的下载路径，否则使用默认路径
        if downloads_dir and isinstance(downloads_dir, Path):
            self.DOWNLOADS_DIR = downloads_dir
        else:
            self.DOWNLOADS_DIR = self.BASE_DIR / 'downloads'
        
        # 确保下载目录存在
        self.DOWNLOADS_DIR.mkdir(exist_ok=True, parents=True)

        # 并发设置
        self.MAX_CONCURRENT_DOWNLOADS = 3
        
        # 日志配置
        self.LOG_DIR = self.BASE_DIR / 'logs'
        self.LOG_DIR.mkdir(exist_ok=True)
        self.LOG_FILE = self.LOG_DIR / 'app.log'
        self.LOG_LEVEL = 'INFO'
        self.LOG_FORMAT = '%(asctime)s - %(name)s - %(levelname)s - %(message)s'

        # yt-dlp 默认输出模板
        self.YTDLP_DEFAULT_OUTTMPL = str(self.DOWNLOADS_DIR / '%(title)s.%(ext)s')

_config_instance = None

# 关键修正: 使用 Optional[Path] 来正确提示可选参数
def get_config(downloads_dir: Optional[Path] = None) -> Config:
    """获取单例的配置对象"""
    global _config_instance
    if _config_instance is None:
        _config_instance = Config(downloads_dir)
    return _config_instance