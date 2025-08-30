// 使用严格模式，这是一种更安全、更规范的 JavaScript 写法，可以避免一些常见错误
'use strict';

// 监听 DOMContentLoaded 事件，确保在整个 HTML 文档被完全加载和解析后再执行脚本
document.addEventListener('DOMContentLoaded', () => {

    // --- 1. 核心功能: 侧边栏页面切换逻辑 ---
    // 获取所有带有 .nav-item 类的导航按钮元素
    const navItems = document.querySelectorAll('.sidebar-nav .nav-item');
    // 获取所有带有 .page-content 类的页面内容板块
    const pages = document.querySelectorAll('.page-content');

    // 遍历每一个导航按钮
    navItems.forEach(item => {
        //为每个导航按钮添加一个点击事件监听器
        item.addEventListener('click', () => {
            // 当按钮被点击时，从其 data-target 属性中获取目标页面的 ID
            const targetId = item.dataset.target;
            // 根据获取到的 ID，在文档中查找对应的页面元素
            const targetPage = document.getElementById(targetId);

            // 健壮性检查：如果根据 ID 找不到对应的页面，就在控制台打印错误信息并终止执行，防止程序崩溃
            if (!targetPage) {
                console.error(`错误: 找不到 ID 为 "${targetId}" 的页面。`);
                return;
            }

            // 更新导航按钮的激活状态
            navItems.forEach(nav => {
                // 移除所有导航按钮的 'active' 类
                nav.classList.remove('active');
                // 更新 ARIA 属性，表示它们都未被选中，这对于屏幕阅读器用户很重要
                nav.setAttribute('aria-selected', 'false');
            });
            // 为当前被点击的按钮添加 'active' 类，使其高亮
            item.classList.add('active');
            // 更新其 ARIA 属性，表示它当前被选中
            item.setAttribute('aria-selected', 'true');

            // 更新页面的显示状态
            pages.forEach(page => page.classList.remove('active')); // 隐藏所有页面
            targetPage.classList.add('active'); // 只显示目标页面
        });
    });

    // --- 2. 辅助功能: 通用的激活状态切换函数 ---
    /**
     * 这是一个可复用的函数，用于为一组元素添加点击时切换 'active' 类的功能。
     * 当组内某个元素被点击时，它会获得 'active' 类，而组内其他所有元素会移除 'active' 类。
     * @param {string} selector - 用于选中这组元素的CSS选择器。
     */
    function setupActiveClassToggler(selector) {
        // 根据传入的选择器，获取所有匹配的元素
        const elements = document.querySelectorAll(selector);
        // 如果没有找到任何元素，就直接返回，不执行后续操作
        if (!elements.length) return;

        // 遍历找到的每一个元素
        elements.forEach(element => {
            // 为每个元素添加点击事件监听器
            element.addEventListener('click', function () {
                // 'this' 在这里指向被点击的那个元素
                // 首先，遍历组内的所有元素，移除它们的 'active' 类
                elements.forEach(el => el.classList.remove('active'));
                // 然后，只为当前被点击的元素添加 'active' 类
                this.classList.add('active');
            });
        });
    }

    // 调用上面的函数，为样式选择标签（.tags .tag）设置激活状态切换功能
    setupActiveClassToggler('.tags .tag');
    // 再次调用该函数，为历史记录项（.history-items .history-item）也设置同样的功能
    setupActiveClassToggler('.history-items .history-item');
});