// electron/menu.js

const { Menu, shell } = require('electron');
const path = require('path');
const { getDownloadsPath } = require('./ipc-handlers'); // 导入函数以获取路径

function createApplicationMenu() {
    const template = [
        {
            label: '文件',
            submenu: [
                {
                    label: '打开下载文件夹',
                    accelerator: 'CmdOrCtrl+O',
                    click: () => {
                        // 使用 shell 模块安全地打开路径
                        shell.openPath(getDownloadsPath());
                    }
                },
                { type: 'separator' },
                {
                    label: '退出',
                    role: 'quit' // 使用内置角色以确保跨平台兼容性
                }
            ]
        },
        {
            label: '编辑',
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