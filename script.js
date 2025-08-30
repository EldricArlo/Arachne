// 'DOMContentLoaded' 事件确保我们的脚本在整个HTML文档被完全加载和解析之后才运行
// 这样做可以防止因尝试操作尚未存在的HTML元素而导致的错误
document.addEventListener('DOMContentLoaded', () => {

    // --- 1. 核心功能: 侧边栏页面切换逻辑 ---

    // 选取所有导航项 (li 元素)
    const navItems = document.querySelectorAll('.sidebar-nav .nav-item');
    // 选取所有可切换的页面内容 (div 元素)
    const pages = document.querySelectorAll('.page-content');

    // 遍历每一个导航项，并为它们分别添加点击事件监听器
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            // -- 当一个导航项被点击时，执行以下操作 --

            // 1. 从被点击项的 `data-target` 属性中获取目标页面的ID (例如 'page-generator')
            const targetId = item.dataset.target;
            // 使用获取到的ID在文档中查找对应的页面元素
            const targetPage = document.getElementById(targetId);

            // 安全检查：如果找不到对应的页面，则直接退出函数，不执行后续操作
            if (!targetPage) {
                console.error(`Error: Page with ID "${targetId}" not found.`);
                return;
            }

            // 2. 更新侧边栏导航项的激活状态
            // 首先，移除所有导航项的 'active' 类
            navItems.forEach(nav => nav.classList.remove('active'));
            // 然后，只为当前被点击的这一个项添加 'active' 类
            item.classList.add('active');

            // 3. 更新页面的显示状态
            // 首先，隐藏所有页面 (通过移除 'active' 类)
            pages.forEach(page => page.classList.remove('active'));
            // 然后，只显示目标页面 (通过添加 'active' 类)
            targetPage.classList.add('active');
        });
    });


    // --- 2. 辅助功能: 通用的激活状态切换函数 ---
    // 这个函数用于处理那些不需要切换整个页面，只需要在小组件内部切换高亮状态的元素 (例如风格标签、历史记录项)
    
    /**
     * 为一组元素添加点击时切换 'active' 类的功能。
     * @param {string} selector - 用于选中这组元素的CSS选择器 (例如 '.tag')
     */
    function setupActiveClassToggler(selector) {
        // 根据选择器找到页面上所有相关的元素
        const elements = document.querySelectorAll(selector);
        // 如果没有找到任何元素，就直接退出
        if (elements.length === 0) return;

        // 遍历所有找到的元素
        elements.forEach(element => {
            // 为每个元素添加点击事件监听
            element.addEventListener('click', function() {
                // 当任何一个元素被点击时，先把这个组里所有元素的 'active' 类都移除
                elements.forEach(el => el.classList.remove('active'));
                // 然后，只为当前被点击的这一个元素添加 'active' 类
                this.classList.add('active');
            });
        });
    }

    // 将上述通用切换功能应用到风格标签和历史记录项上
    setupActiveClassToggler('.tag');
    setupActiveClassToggler('.history-item');

});