// electron/menu.js

const { Menu, shell } = require('electron');
const { getDownloadsPath } = require('./ipc-handlers');

/**
 * 创建并设置应用程序的顶部菜单栏。
 */
function createApplicationMenu() {
    const template = [
        {
            label: '文件',
            submenu: [
                {
                    label: '打开下载文件夹',
                    accelerator: 'CmdOrCtrl+O', // 设置快捷键
                    click: () => {
                        // 使用 shell 模块安全地打开路径
                        shell.openPath(getDownloadsPath());
                    }
                },
                { type: 'separator' }, // 分隔线
                {
                    label: '退出',
                    role: 'quit' // 使用内置角色，自动处理跨平台的退出逻辑
                }
            ]
        },
        {
            label: '编辑',
            // 使用内置角色可以自动获得标准的编辑功能和快捷键
            submenu: [
                { label: '撤销', role: 'undo' },
                { label: '重做', role: 'redo' },
                { type: 'separator' },
                { label: '剪切', role: 'cut' },
                { label: '复制', role: 'copy' },
                { label: '粘贴', role: 'paste' }
            ]
        },
        {
            label: '视图',
            submenu: [
                { label: '重新加载', role: 'reload' },
                { label: '强制重新加载', role: 'forceReload' },
                { label: '开发者工具', role: 'toggleDevTools' },
                { type: 'separator' },
                { label: '实际大小', role: 'resetZoom' },
                { label: '放大', role: 'zoomIn' },
                { label: '缩小', role: 'zoomOut' },
                { type: 'separator' },
                { label: '全屏', role: 'togglefullscreen' }
            ]
        }
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
}

module.exports = { createApplicationMenu };
