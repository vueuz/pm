// 当前配置
let currentConfig = null;

// DOM 元素
let elements = {};

// 图标列表
let iconList = [];

// 监听来自父窗口的消息以获取 electronAPI
window.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'ELECTRON_API_PROXY') {
        window.electronAPI = event.data.api;
        console.log('Received electronAPI proxy from parent');
        // 重新加载配置
        loadConfig();
        loadIconList();
    }
});

// 初始化
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Settings page loaded');
    
    // 获取DOM元素引用
    elements = {
        // 标签页元素
        menuItems: document.querySelectorAll('.menu-item'),
        tabs: document.querySelectorAll('.settings-tab'),
        
        // 操作按钮
        saveBtn: document.getElementById('save-btn'),
        resetBtn: document.getElementById('reset-btn'),
        previewBtn: document.getElementById('preview-btn'),
        addAppBtn: document.getElementById('add-app-btn'),
        
        // 表单元素
        showSettingsButton: document.getElementById('show-settings-button'),
        showStatusBar: document.getElementById('show-status-bar'),
        backgroundImage: document.getElementById('background-image'),
        overlayOpacity: document.getElementById('overlay-opacity'),
        overlayOpacityValue: document.getElementById('overlay-opacity-value'),
        backgroundBlur: document.getElementById('background-blur'),
        backgroundBlurValue: document.getElementById('background-blur-value'),
        layoutColumns: document.getElementById('layout-columns'),
        layoutRows: document.getElementById('layout-rows'),
        overallScale: document.getElementById('overall-scale'),
        hideIconNames: document.getElementById('hide-icon-names'),
        showIconShadow: document.getElementById('show-icon-shadow'),
        enableAnimation: document.getElementById('enable-animation'),
        iconSize: document.getElementById('icon-size'),
        iconSizeValue: document.getElementById('icon-size-value'),
        containerPaddingVertical: document.getElementById('container-padding-vertical'),
        containerPaddingVerticalValue: document.getElementById('container-padding-vertical-value'),
        containerPaddingHorizontal: document.getElementById('container-padding-horizontal'),
        containerPaddingHorizontalValue: document.getElementById('container-padding-horizontal-value'),
        iconGap: document.getElementById('icon-gap'),
        iconGapValue: document.getElementById('icon-gap-value'),
        dockBgColor: document.getElementById('dock-bg-color'),
        dockBgOpacity: document.getElementById('dock-bg-opacity'),
        dockBgOpacityValue: document.getElementById('dock-bg-opacity-value'),
        dockBlur: document.getElementById('dock-blur'),
        dockBlurValue: document.getElementById('dock-blur-value'),
        windowBorderColor: document.getElementById('window-border-color'),
        windowTitleColor: document.getElementById('window-title-color'),
        windowHeaderBgColor: document.getElementById('window-header-bg-color'),
        exportConfigBtn: document.getElementById('export-config-btn'),
        importConfigBtn: document.getElementById('import-config-btn'),
        themeSelect: document.getElementById('theme-select'),
        appsList: document.getElementById('apps-list')
    };
    
    // 设置事件监听器
    setupEventListeners();
    
    // 尝试加载配置和图标列表
    if (typeof window.electronAPI !== 'undefined') {
        await loadConfig();
        await loadIconList();
        renderAppsList();
    }
});

// 显示错误信息
function showError(message) {
    // 清空页面内容
    document.body.innerHTML = '';
    
    // 创建错误信息元素
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = `
        position: fixed; 
        top: 0; 
        left: 0; 
        width: 100%; 
        height: 100%; 
        background: rgba(0,0,0,0.8); 
        color: white; 
        display: flex; 
        justify-content: center; 
        align-items: center; 
        z-index: 9999;
        flex-direction: column;
    `;
    
    errorDiv.innerHTML = `
        <div style="text-align: center; padding: 20px; background: #333; border-radius: 10px;">
            <h2>配置加载错误</h2>
            <p>${message}</p>
            <p>错误详情: ${typeof window.electronAPI === 'undefined' ? 'electronAPI 未定义' : 'electronAPI 已定义'}</p>
            <div style="margin-top: 15px;">
                <button id="reset-default-config" style="padding: 10px 20px; background: #ffc107; color: #000; border: none; border-radius: 5px; cursor: pointer; margin: 5px;">重置为默认配置</button>
                <button onclick="window.close()" style="padding: 10px 20px; background: #007bff; color: white; border: none; border-radius: 5px; cursor: pointer; margin: 5px;">关闭页面</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(errorDiv);
    
    // 添加重置为默认配置按钮的事件监听器
    const resetButton = document.getElementById('reset-default-config');
    if (resetButton) {
        resetButton.addEventListener('click', resetToDefaultConfig);
    }
}

// 重置为默认配置
async function resetToDefaultConfig() {
    try {
        // 确保 electronAPI 可用
        if (typeof window.electronAPI === 'undefined') {
            alert('无法访问系统配置，请关闭设置页面并重新打开');
            return;
        }
        
        // 尝试重置配置
        const config = await window.electronAPI.resetConfig();
        if (config) {
            // 重置成功，重新加载页面
            location.reload();
        } else {
            alert('重置默认配置失败');
        }
    } catch (error) {
        console.error('Failed to reset config:', error);
        alert('重置默认配置时发生错误: ' + error.message);
    }
}

// 加载配置
async function loadConfig() {
    try {
        if (typeof window.electronAPI === 'undefined') {
            throw new Error('electronAPI 未定义');
        }
        
        currentConfig = await window.electronAPI.getConfig();
        
        if (!currentConfig) {
            // 如果没有配置，使用默认配置
            currentConfig = {
                apps: [
                    { id: 'baidu', name: '百度', url: 'https://www.baidu.com', icon: 'AI智能分析-多色.png', visible: true },
                    { id: 'bing', name: '必应', url: 'https://www.bing.com', icon: '场景推演-多色.png', visible: true },
                    { id: 'settings', name: '设置', url: 'settings/index.html', icon: '数字实验室-多色.png', visible: true },
                    { id: 'shutdown', name: '切换系统', url: '#', icon: '地遁化境-多色.png', visible: true }
                ],
                interface: {
                    showSettingsButton: true,
                    showStatusBar: true
                },
                background: {
                    imageUrl: 'assets/background/defualt.png',
                    overlayOpacity: 30,
                    blur: 0
                },
                layout: {
                    columns: 4,
                    rows: 3
                },
                scaling: {
                    overallScale: 1.0
                },
                icon: {
                    hideNames: false,
                    showShadow: true,
                    enableAnimation: true,
                    size: 100
                },
                theme: 'default'
            };
        }
        populateForm();
    } catch (error) {
        console.error('Failed to load config:', error);
        showError('加载配置失败: ' + (error.message || '未知错误'));
    }
}

// 加载图标列表
async function loadIconList() {
    try {
        if (typeof window.electronAPI === 'undefined') {
            throw new Error('electronAPI 未定义');
        }
        
        iconList = await window.electronAPI.getIconList();
    } catch (error) {
        console.error('Failed to load icon list:', error);
        iconList = [];
    }
}

// 填充表单
function populateForm() {
    if (!currentConfig) return;
    
    // 界面元素配置
    if (elements.showSettingsButton) elements.showSettingsButton.checked = currentConfig.interface.showSettingsButton;
    if (elements.showStatusBar) elements.showStatusBar.checked = currentConfig.interface.showStatusBar;
    
    // 背景设置
    if (elements.backgroundImage) elements.backgroundImage.value = currentConfig.background.imageUrl || '';
    if (elements.overlayOpacity) elements.overlayOpacity.value = currentConfig.background.overlayOpacity || 30;
    if (elements.overlayOpacityValue) elements.overlayOpacityValue.textContent = currentConfig.background.overlayOpacity || 30;
    if (elements.backgroundBlur) elements.backgroundBlur.value = currentConfig.background.blur || 0;
    if (elements.backgroundBlurValue) elements.backgroundBlurValue.textContent = currentConfig.background.blur || 0;
    
    // 布局设置
    if (elements.layoutColumns) elements.layoutColumns.value = currentConfig.layout.columns || 4;
    if (elements.layoutRows) elements.layoutRows.value = currentConfig.layout.rows || 3;
    
    // 缩放设置
    if (elements.overallScale) elements.overallScale.value = currentConfig.scaling.overallScale || 1.0;
    
    // 图标设置
    if (elements.hideIconNames) elements.hideIconNames.checked = currentConfig.icon.hideNames || false;
    if (elements.showIconShadow) elements.showIconShadow.checked = currentConfig.icon.showShadow || true;
    if (elements.enableAnimation) elements.enableAnimation.checked = currentConfig.icon.enableAnimation || true;
    if (elements.iconSize) elements.iconSize.value = currentConfig.icon.size || 100;
    if (elements.iconSizeValue) elements.iconSizeValue.textContent = currentConfig.icon.size || 100;
    
    // 间距设置
    if (!currentConfig.spacing) {
        currentConfig.spacing = {
            containerPaddingVertical: 20,
            containerPaddingHorizontal: 20,
            iconGap: 20
        };
    }
    if (elements.containerPaddingVertical) elements.containerPaddingVertical.value = currentConfig.spacing.containerPaddingVertical || 20;
    if (elements.containerPaddingVerticalValue) elements.containerPaddingVerticalValue.textContent = currentConfig.spacing.containerPaddingVertical || 20;
    if (elements.containerPaddingHorizontal) elements.containerPaddingHorizontal.value = currentConfig.spacing.containerPaddingHorizontal || 20;
    if (elements.containerPaddingHorizontalValue) elements.containerPaddingHorizontalValue.textContent = currentConfig.spacing.containerPaddingHorizontal || 20;
    if (elements.iconGap) elements.iconGap.value = currentConfig.spacing.iconGap || 20;
    if (elements.iconGapValue) elements.iconGapValue.textContent = currentConfig.spacing.iconGap || 20;
    
    // Dock栏设置
    if (!currentConfig.dock) {
        currentConfig.dock = {
            backgroundColor: '#000000',
            backgroundOpacity: 50,
            blur: 20
        };
    }
    if (elements.dockBgColor) elements.dockBgColor.value = currentConfig.dock.backgroundColor || '#000000';
    if (elements.dockBgOpacity) elements.dockBgOpacity.value = currentConfig.dock.backgroundOpacity || 50;
    if (elements.dockBgOpacityValue) elements.dockBgOpacityValue.textContent = currentConfig.dock.backgroundOpacity || 50;
    if (elements.dockBlur) elements.dockBlur.value = currentConfig.dock.blur || 20;
    if (elements.dockBlurValue) elements.dockBlurValue.textContent = currentConfig.dock.blur || 20;
    
    // 窗口设置
    if (!currentConfig.window) {
        currentConfig.window = {
            borderColor: '#ddd',
            titleColor: '#333',
            headerBackgroundColor: '#f5f5f5'
        };
    }
    if (elements.windowBorderColor) elements.windowBorderColor.value = currentConfig.window.borderColor || '#ddd';
    if (elements.windowTitleColor) elements.windowTitleColor.value = currentConfig.window.titleColor || '#333';
    if (elements.windowHeaderBgColor) elements.windowHeaderBgColor.value = currentConfig.window.headerBackgroundColor || '#f5f5f5';
    
    // 开屏视频设置
    if (!currentConfig.initVideo) {
        currentConfig.initVideo = {
            enabled: true,
            path: 'assets/load/init.mp4',
            allowSkip: true
        };
    }
    const initVideoEnabledYes = document.querySelector('input[name="init-video-enabled"][value="true"]');
    const initVideoEnabledNo = document.querySelector('input[name="init-video-enabled"][value="false"]');
    if (initVideoEnabledYes && initVideoEnabledNo) {
        if (currentConfig.initVideo.enabled) {
            initVideoEnabledYes.checked = true;
        } else {
            initVideoEnabledNo.checked = true;
        }
    }
    
    const initVideoAllowSkipYes = document.querySelector('input[name="init-video-allow-skip"][value="true"]');
    const initVideoAllowSkipNo = document.querySelector('input[name="init-video-allow-skip"][value="false"]');
    if (initVideoAllowSkipYes && initVideoAllowSkipNo) {
        if (currentConfig.initVideo.allowSkip !== false) {
            initVideoAllowSkipYes.checked = true;
        } else {
            initVideoAllowSkipNo.checked = true;
        }
    }
    
    // 轮播图设置
    if (!currentConfig.carousel) {
        currentConfig.carousel = {
            enabled: true,
            images: [],
            switchTime: 3000,
            displayDuration: 10
        };
    }
    const carouselEnabledYes = document.querySelector('input[name="carousel-enabled"][value="true"]');
    const carouselEnabledNo = document.querySelector('input[name="carousel-enabled"][value="false"]');
    if (carouselEnabledYes && carouselEnabledNo) {
        if (currentConfig.carousel.enabled !== false) {
            carouselEnabledYes.checked = true;
        } else {
            carouselEnabledNo.checked = true;
        }
    }
    
    // 主题设置
    if (elements.themeSelect) elements.themeSelect.value = currentConfig.theme || 'default';
}

// 设置事件监听器
function setupEventListeners() {
    // 标签页切换
    if (elements.menuItems) {
        elements.menuItems.forEach(item => {
            item.addEventListener('click', () => {
                const tabId = item.dataset.tab;
                switchTab(tabId);
            });
        });
    }
    
    // 显示配置路径按钮
    const showConfigPathBtn = document.getElementById('show-config-path');
    if (showConfigPathBtn) {
        showConfigPathBtn.addEventListener('click', async () => {
            try {
                const pathInfo = await window.electronAPI.getConfigPath();
                alert(`配置文件路径：
${pathInfo.configPath}

配置目录：
${pathInfo.configDir}`);
            } catch (error) {
                console.error('Failed to get config path:', error);
                alert('获取配置路径失败: ' + error.message);
            }
        });
    }
    
    // 操作按钮
    if (elements.saveBtn) elements.saveBtn.addEventListener('click', saveConfig);
    if (elements.resetBtn) elements.resetBtn.addEventListener('click', resetConfig);
    if (elements.previewBtn) elements.previewBtn.addEventListener('click', previewConfig);
    if (elements.addAppBtn) elements.addAppBtn.addEventListener('click', addApp);
    
    // 实时更新配置
    setupRealTimeConfigUpdate();
    
    // 配置管理
    if (elements.exportConfigBtn) elements.exportConfigBtn.addEventListener('click', exportConfig);
    if (elements.importConfigBtn) elements.importConfigBtn.addEventListener('click', importConfig);
}

// 设置实时配置更新
function setupRealTimeConfigUpdate() {
    // 范围输入值显示及实时更新
    if (elements.overlayOpacity) {
        elements.overlayOpacity.addEventListener('input', () => {
            if (elements.overlayOpacityValue) {
                elements.overlayOpacityValue.textContent = elements.overlayOpacity.value;
            }
            updateConfigAndApply();
        });
    }
    
    if (elements.backgroundBlur) {
        elements.backgroundBlur.addEventListener('input', () => {
            if (elements.backgroundBlurValue) {
                elements.backgroundBlurValue.textContent = elements.backgroundBlur.value;
            }
            updateConfigAndApply();
        });
    }
    
    if (elements.iconSize) {
        elements.iconSize.addEventListener('input', () => {
            if (elements.iconSizeValue) {
                elements.iconSizeValue.textContent = elements.iconSize.value;
            }
            updateConfigAndApply();
        });
    }
    
    if (elements.containerPaddingVertical) {
        elements.containerPaddingVertical.addEventListener('input', () => {
            if (elements.containerPaddingVerticalValue) {
                elements.containerPaddingVerticalValue.textContent = elements.containerPaddingVertical.value;
            }
            updateConfigAndApply();
        });
    }
    
    if (elements.containerPaddingHorizontal) {
        elements.containerPaddingHorizontal.addEventListener('input', () => {
            if (elements.containerPaddingHorizontalValue) {
                elements.containerPaddingHorizontalValue.textContent = elements.containerPaddingHorizontal.value;
            }
            updateConfigAndApply();
        });
    }
    
    if (elements.iconGap) {
        elements.iconGap.addEventListener('input', () => {
            if (elements.iconGapValue) {
                elements.iconGapValue.textContent = elements.iconGap.value;
            }
            updateConfigAndApply();
        });
    }
    
    // Dock栏设置实时更新
    if (elements.dockBgColor) elements.dockBgColor.addEventListener('change', updateConfigAndApply);
    
    if (elements.dockBgOpacity) {
        elements.dockBgOpacity.addEventListener('input', () => {
            if (elements.dockBgOpacityValue) {
                elements.dockBgOpacityValue.textContent = elements.dockBgOpacity.value;
            }
            updateConfigAndApply();
        });
    }
    
    if (elements.dockBlur) {
        elements.dockBlur.addEventListener('input', () => {
            if (elements.dockBlurValue) {
                elements.dockBlurValue.textContent = elements.dockBlur.value;
            }
            updateConfigAndApply();
        });
    }
    
    // 窗口设置实时更新
    if (elements.windowBorderColor) elements.windowBorderColor.addEventListener('change', updateConfigAndApply);
    if (elements.windowTitleColor) elements.windowTitleColor.addEventListener('change', updateConfigAndApply);
    if (elements.windowHeaderBgColor) elements.windowHeaderBgColor.addEventListener('change', updateConfigAndApply);
    
    // 布局设置实时更新
    if (elements.layoutColumns) elements.layoutColumns.addEventListener('change', updateConfigAndApply);
    if (elements.layoutRows) elements.layoutRows.addEventListener('change', updateConfigAndApply);
    
    // 缩放设置实时更新
    if (elements.overallScale) elements.overallScale.addEventListener('change', updateConfigAndApply);
    
    // 布尔值设置实时更新
    if (elements.showSettingsButton) elements.showSettingsButton.addEventListener('change', updateConfigAndApply);
    if (elements.showStatusBar) elements.showStatusBar.addEventListener('change', updateConfigAndApply);
    if (elements.hideIconNames) elements.hideIconNames.addEventListener('change', updateConfigAndApply);
    if (elements.showIconShadow) elements.showIconShadow.addEventListener('change', updateConfigAndApply);
    if (elements.enableAnimation) elements.enableAnimation.addEventListener('change', updateConfigAndApply);
    
    // 开屏视频设置实时更新
    const initVideoEnabledRadios = document.querySelectorAll('input[name="init-video-enabled"]');
    initVideoEnabledRadios.forEach(radio => {
        radio.addEventListener('change', updateConfigAndApply);
    });
    
    const initVideoAllowSkipRadios = document.querySelectorAll('input[name="init-video-allow-skip"]');
    initVideoAllowSkipRadios.forEach(radio => {
        radio.addEventListener('change', updateConfigAndApply);
    });
    
    // 轮播图设置实时更新
    const carouselEnabledRadios = document.querySelectorAll('input[name="carousel-enabled"]');
    carouselEnabledRadios.forEach(radio => {
        radio.addEventListener('change', updateConfigAndApply);
    });
    
    // 背景图片实时更新
    if (elements.backgroundImage) elements.backgroundImage.addEventListener('change', updateConfigAndApply);
    
    // 主题设置实时更新
    if (elements.themeSelect) elements.themeSelect.addEventListener('change', updateConfigAndApply);
}

// 切换标签页
function switchTab(tabId) {
    // 更新菜单项
    if (elements.menuItems) {
        elements.menuItems.forEach(item => {
            item.classList.toggle('active', item.dataset.tab === tabId);
        });
    }
    
    // 更新标签页
    if (elements.tabs) {
        elements.tabs.forEach(tab => {
            tab.classList.toggle('active', tab.id === `${tabId}-tab`);
        });
    }
}

// 收集表单数据
function collectFormData() {
    if (!currentConfig) return;
    
    // 界面元素配置
    if (elements.showSettingsButton) currentConfig.interface.showSettingsButton = elements.showSettingsButton.checked;
    if (elements.showStatusBar) currentConfig.interface.showStatusBar = elements.showStatusBar.checked;
    
    // 背景设置
    if (elements.backgroundImage) currentConfig.background.imageUrl = elements.backgroundImage.value;
    if (elements.overlayOpacity) currentConfig.background.overlayOpacity = parseInt(elements.overlayOpacity.value);
    if (elements.backgroundBlur) currentConfig.background.blur = parseInt(elements.backgroundBlur.value);
    
    // 布局设置
    if (elements.layoutColumns) currentConfig.layout.columns = parseInt(elements.layoutColumns.value);
    if (elements.layoutRows) currentConfig.layout.rows = parseInt(elements.layoutRows.value);
    
    // 缩放设置
    if (elements.overallScale) currentConfig.scaling.overallScale = parseFloat(elements.overallScale.value);
    
    // 图标设置
    if (elements.hideIconNames) currentConfig.icon.hideNames = elements.hideIconNames.checked;
    if (elements.showIconShadow) currentConfig.icon.showShadow = elements.showIconShadow.checked;
    if (elements.enableAnimation) currentConfig.icon.enableAnimation = elements.enableAnimation.checked;
    if (elements.iconSize) currentConfig.icon.size = parseInt(elements.iconSize.value);
    
    // 间距设置
    if (!currentConfig.spacing) {
        currentConfig.spacing = {};
    }
    if (elements.containerPaddingVertical) currentConfig.spacing.containerPaddingVertical = parseInt(elements.containerPaddingVertical.value);
    if (elements.containerPaddingHorizontal) currentConfig.spacing.containerPaddingHorizontal = parseInt(elements.containerPaddingHorizontal.value);
    if (elements.iconGap) currentConfig.spacing.iconGap = parseInt(elements.iconGap.value);
    
    // Dock栏设置
    if (!currentConfig.dock) {
        currentConfig.dock = {};
    }
    if (elements.dockBgColor) currentConfig.dock.backgroundColor = elements.dockBgColor.value;
    if (elements.dockBgOpacity) currentConfig.dock.backgroundOpacity = parseInt(elements.dockBgOpacity.value);
    if (elements.dockBlur) currentConfig.dock.blur = parseInt(elements.dockBlur.value);
    
    // 窗口设置
    if (!currentConfig.window) {
        currentConfig.window = {};
    }
    if (elements.windowBorderColor) currentConfig.window.borderColor = elements.windowBorderColor.value;
    if (elements.windowTitleColor) currentConfig.window.titleColor = elements.windowTitleColor.value;
    if (elements.windowHeaderBgColor) currentConfig.window.headerBackgroundColor = elements.windowHeaderBgColor.value;
    
    // 开屏视频设置
    if (!currentConfig.initVideo) {
        currentConfig.initVideo = {};
    }
    const initVideoEnabledYes = document.querySelector('input[name="init-video-enabled"][value="true"]');
    if (initVideoEnabledYes) currentConfig.initVideo.enabled = initVideoEnabledYes.checked;
    
    const initVideoAllowSkipYes = document.querySelector('input[name="init-video-allow-skip"][value="true"]');
    if (initVideoAllowSkipYes) currentConfig.initVideo.allowSkip = initVideoAllowSkipYes.checked;
    
    // 轮播图设置
    if (!currentConfig.carousel) {
        currentConfig.carousel = {};
    }
    const carouselEnabledYes = document.querySelector('input[name="carousel-enabled"][value="true"]');
    if (carouselEnabledYes) currentConfig.carousel.enabled = carouselEnabledYes.checked;
    
    // 主题设置
    if (elements.themeSelect) currentConfig.theme = elements.themeSelect.value;
}

// 更新配置并应用到主界面
async function updateConfigAndApply() {
    try {
        if (typeof window.electronAPI === 'undefined') {
            console.warn('electronAPI not available, skipping config update');
            return;
        }
        
        // 收集表单数据
        collectFormData();
        
        // 保存配置
        const result = await window.electronAPI.saveConfig(currentConfig);
        if (result) {
            // 发送消息到主窗口以应用新配置
            await window.electronAPI.applyConfig(currentConfig);
        }
    } catch (error) {
        console.error('Failed to update config:', error);
    }
}

// 保存配置
async function saveConfig() {
    try {
        if (typeof window.electronAPI === 'undefined') {
            alert('无法访问系统配置，请关闭设置页面并重新打开');
            return;
        }
        
        // 收集表单数据
        collectFormData();
        
        // 保存配置
        const result = await window.electronAPI.saveConfig(currentConfig);
        if (result) {
            alert('配置保存成功');
        } else {
            alert('配置保存失败');
        }
    } catch (error) {
        console.error('Failed to save config:', error);
        alert('保存配置时发生错误: ' + error.message);
    }
}

// 重置配置
async function resetConfig() {
    if (confirm('确定要恢复默认配置吗？这将丢失所有自定义设置。')) {
        try {
            if (typeof window.electronAPI === 'undefined') {
                alert('无法访问系统配置，请关闭设置页面并重新打开');
                return;
            }
            
            const config = await window.electronAPI.resetConfig();
            if (config) {
                currentConfig = config;
                populateForm();
                renderAppsList();
                // 应用重置后的配置
                await window.electronAPI.applyConfig(currentConfig);
                alert('已恢复默认配置');
            } else {
                alert('恢复默认配置失败');
            }
        } catch (error) {
            console.error('Failed to reset config:', error);
            alert('恢复默认配置时发生错误: ' + error.message);
        }
    }
}

// 预览配置
function previewConfig() {
    alert('预览功能将在后续版本中实现');
}

// 添加应用
function addApp() {
    if (!currentConfig) return;
    
    const newApp = {
        id: `app_${Date.now()}`,
        name: '新应用',
        url: '',
        icon: iconList.length > 0 ? iconList[0] : '',
        visible: true
    };
    
    currentConfig.apps.push(newApp);
    renderAppsList();
    // 实时更新配置
    updateConfigAndApply();
}

// 渲染应用列表
function renderAppsList() {
    const appsList = document.getElementById('apps-list');
    if (!appsList) return;

    appsList.innerHTML = '';
    
    this.config.apps.forEach((app, index) => {
        const appItem = document.createElement('div');
        appItem.className = 'app-config-item';
        appItem.innerHTML = `
            <div class="app-config-header">
                <label class="radio-group">
                    <span class="app-name">${app.name}</span>
                    <label class="radio-option">
                        <input type="radio" name="app-visible-${index}" value="true" ${app.visible ? 'checked' : ''}>
                        <span class="radio-label">显示</span>
                    </label>
                    <label class="radio-option">
                        <input type="radio" name="app-visible-${index}" value="false" ${!app.visible ? 'checked' : ''}>
                        <span class="radio-label">隐藏</span>
                    </label>
                </label>
            </div>
            <div class="app-config-fields">
                <div class="form-group">
                    <label for="app-icon-${index}">图标</label>
                    <input type="text" id="app-icon-${index}" class="form-control" value="${app.icon || ''}">
                </div>
                <div class="form-group">
                    <label for="app-name-${index}">应用名称</label>
                    <input type="text" id="app-name-${index}" class="form-control" value="${app.name}">
                </div>
                <div class="form-group">
                    <label for="app-url-${index}">应用URL</label>
                    <input type="text" id="app-url-${index}" class="form-control" value="${app.url || ''}">
                </div>
            </div>
        `;
        appsList.appendChild(appItem);
    });
}

// 处理应用名称输入
function handleNameInput(e) {
    const idx = parseInt(e.target.dataset.index);
    if (currentConfig && currentConfig.apps && currentConfig.apps[idx]) {
        currentConfig.apps[idx].name = e.target.value;
        updateConfigAndApply();
    }
}

// 处理URL输入
function handleUrlInput(e) {
    const idx = parseInt(e.target.dataset.index);
    if (currentConfig && currentConfig.apps && currentConfig.apps[idx]) {
        currentConfig.apps[idx].url = e.target.value;
        updateConfigAndApply();
    }
}

// 处理图标更改
function handleIconChange(e) {
    const idx = parseInt(e.target.dataset.index);
    const selectedValue = e.target.value;
    if (currentConfig && currentConfig.apps && currentConfig.apps[idx]) {
        currentConfig.apps[idx].icon = selectedValue;
        
        // 更新图标预览
        const appElement = e.target.closest('.app-item');
        if (appElement) {
            let preview = appElement.querySelector('.icon-preview');
            if (preview) {
                preview.innerHTML = `<img src="../assets/icons/${selectedValue}" onerror="this.src='../assets/icons/数字实验室-多色.png'" alt="图标预览">`;
            } else {
                const previewDiv = document.createElement('div');
                previewDiv.className = 'icon-preview';
                previewDiv.innerHTML = `<img src="../assets/icons/${selectedValue}" onerror="this.src='../assets/icons/数字实验室-多色.png'" alt="图标预览">`;
                e.target.parentNode.appendChild(previewDiv);
            }
        }
        updateConfigAndApply();
    }
}

// 处理可见性更改
function handleVisibleChange(e) {
    const idx = parseInt(e.target.dataset.index);
    if (currentConfig && currentConfig.apps && currentConfig.apps[idx]) {
        currentConfig.apps[idx].visible = e.target.checked;
        updateConfigAndApply();
    }
}

// 处理上移按钮点击
function handleMoveUp(e) {
    const idx = parseInt(e.target.dataset.index);
    if (currentConfig && currentConfig.apps && idx > 0) {
        const temp = currentConfig.apps[idx];
        currentConfig.apps[idx] = currentConfig.apps[idx - 1];
        currentConfig.apps[idx - 1] = temp;
        renderAppsList();
        updateConfigAndApply();
    }
}

// 处理下移按钮点击
function handleMoveDown(e) {
    const idx = parseInt(e.target.dataset.index);
    if (currentConfig && currentConfig.apps && idx < currentConfig.apps.length - 1) {
        const temp = currentConfig.apps[idx];
        currentConfig.apps[idx] = currentConfig.apps[idx + 1];
        currentConfig.apps[idx + 1] = temp;
        renderAppsList();
        updateConfigAndApply();
    }
}

// 处理删除按钮点击
function handleDelete(e) {
    const idx = parseInt(e.target.dataset.index);
    if (currentConfig && currentConfig.apps && currentConfig.apps[idx]) {
        const appName = currentConfig.apps[idx].name;
        if (confirm(`确定要删除应用 "${appName}" 吗？`)) {
            currentConfig.apps.splice(idx, 1);
            renderAppsList();
            updateConfigAndApply();
        }
    }
}

// 导出配置
async function exportConfig() {
    try {
        if (typeof window.electronAPI === 'undefined') {
            alert('无法访问系统配置，请关闭设置页面并重新打开');
            return;
        }
        
        const result = await window.electronAPI.showSaveDialog({
            title: '导出配置文件',
            defaultPath: 'config.json',
            filters: [
                { name: 'JSON Files', extensions: ['json'] },
                { name: 'All Files', extensions: ['*'] }
            ]
        });
        
        if (!result.canceled && result.filePath) {
            const exportResult = await window.electronAPI.exportConfig(result.filePath);
            if (exportResult) {
                alert('配置导出成功');
            } else {
                alert('配置导出失败');
            }
        }
    } catch (error) {
        console.error('Failed to export config:', error);
        alert('导出配置时发生错误: ' + error.message);
    }
}

// 导入配置
async function importConfig() {
    try {
        if (typeof window.electronAPI === 'undefined') {
            alert('无法访问系统配置，请关闭设置页面并重新打开');
            return;
        }
        
        const result = await window.electronAPI.showOpenDialog({
            title: '导入配置文件',
            properties: ['openFile'],
            filters: [
                { name: 'JSON Files', extensions: ['json'] },
                { name: 'All Files', extensions: ['*'] }
            ]
        });
        
        if (!result.canceled && result.filePaths.length > 0) {
            const importResult = await window.electronAPI.importConfig(result.filePaths[0]);
            if (importResult) {
                currentConfig = importResult;
                populateForm();
                renderAppsList();
                // 应用导入的配置
                await window.electronAPI.applyConfig(currentConfig);
                alert('配置导入成功');
            } else {
                alert('配置导入失败，请检查文件格式是否正确');
            }
        }
    } catch (error) {
        console.error('Failed to import config:', error);
        alert('导入配置时发生错误: ' + error.message);
    }
}

// 配置管理
class SettingsManager {
    constructor() {
        this.config = {};
        this.init();
    }

    // 初始化
    async init() {
        // 获取配置
        this.config = await electronAPI.getConfig();
        this.renderAppList();
        this.bindEvents();
        this.populateForm();
    }

    // 渲染应用列表
    renderAppList() {
        const appsList = document.getElementById('apps-list');
        if (!appsList) return;

        appsList.innerHTML = '';
        
        this.config.apps.forEach((app, index) => {
            const appItem = document.createElement('div');
            appItem.className = 'app-config-item';
            appItem.innerHTML = `
                <div class="app-config-header">
                    <label class="switch">
                        <input type="checkbox" id="app-visible-${index}" ${app.visible ? 'checked' : ''}>
                        <span class="slider"></span>
                    </label>
                    <span class="app-name">${app.name}</span>
                </div>
                <div class="app-config-fields">
                    <div class="form-group">
                        <label for="app-icon-${index}">图标</label>
                        <input type="text" id="app-icon-${index}" class="form-control" value="${app.icon || ''}">
                    </div>
                    <div class="form-group">
                        <label for="app-name-${index}">应用名称</label>
                        <input type="text" id="app-name-${index}" class="form-control" value="${app.name}">
                    </div>
                    <div class="form-group">
                        <label for="app-url-${index}">应用URL</label>
                        <input type="text" id="app-url-${index}" class="form-control" value="${app.url || ''}">
                    </div>
                </div>
            `;
            appsList.appendChild(appItem);
        });
    }

    // 绑定事件
    bindEvents() {
        // 导航切换
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const target = e.target.dataset.target;
                this.switchTab(target);
            });
        });

        // 表单字段变化事件
        document.querySelectorAll('input, textarea, select').forEach(element => {
            // 对于单选框，监听change事件
            if (element.type === 'radio') {
                element.addEventListener('change', () => this.onFieldChange());
            } 
            // 对于复选框，监听change事件
            else if (element.type === 'checkbox') {
                element.addEventListener('change', () => this.onFieldChange());
            } 
            // 对于其他输入元素，监听input事件
            else {
                element.addEventListener('input', () => this.onFieldChange());
            }
        });

        // 恢复默认配置
        document.getElementById('reset-config')?.addEventListener('click', () => {
            if (confirm('确定要恢复默认配置吗？这将丢失所有当前设置。')) {
                this.resetConfig();
            }
        });

        // 导出配置
        document.getElementById('export-config')?.addEventListener('click', () => {
            this.exportConfig();
        });

        // 导入配置
        document.getElementById('import-config')?.addEventListener('click', () => {
            document.getElementById('import-config-input').click();
        });
        
        document.getElementById('import-config-input')?.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                this.importConfig(file);
            }
            // 重置input值以便下次选择相同文件也能触发change事件
            e.target.value = '';
        });
    }

    // 切换标签页
    switchTab(targetId) {
        // 更新导航激活状态
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.toggle('active', item.dataset.target === targetId);
        });

        // 显示目标部分
        document.querySelectorAll('.settings-section').forEach(section => {
            section.classList.toggle('active', section.id === targetId);
        });
    }

    // 字段变化处理
    onFieldChange() {
        this.updateConfigFromForm();
        this.saveConfig();
    }

    // 从表单更新配置
    updateConfigFromForm() {
        // 更新应用配置
        this.config.apps.forEach((app, index) => {
            const visibleYes = document.querySelector(`input[name="app-visible-${index}"][value="true"]`);
            const iconInput = document.getElementById(`app-icon-${index}`);
            const nameInput = document.getElementById(`app-name-${index}`);
            const urlInput = document.getElementById(`app-url-${index}`);

            if (visibleYes) app.visible = visibleYes.checked;
            if (iconInput) app.icon = iconInput.value;
            if (nameInput) app.name = nameInput.value;
            if (urlInput) app.url = urlInput.value;
        });

        // 更新界面配置
        const showSettingsButtonYes = document.querySelector('input[name="show-settings-button"][value="true"]');
        const showStatusBarYes = document.querySelector('input[name="show-status-bar"][value="true"]');
        
        if (showSettingsButtonYes) this.config.interface.showSettingsButton = showSettingsButtonYes.checked;
        if (showStatusBarYes) this.config.interface.showStatusBar = showStatusBarYes.checked;

        // 更新背景配置
        const backgroundImage = document.getElementById('background-image');
        const overlayOpacity = document.getElementById('overlay-opacity');
        const backgroundBlur = document.getElementById('background-blur');
        
        if (backgroundImage) this.config.background.imageUrl = backgroundImage.value;
        if (overlayOpacity) this.config.background.overlayOpacity = parseInt(overlayOpacity.value);
        if (backgroundBlur) this.config.background.blur = parseInt(backgroundBlur.value);

        // 更新布局配置
        const layoutColumns = document.getElementById('layout-columns');
        const layoutRows = document.getElementById('layout-rows');
        
        if (layoutColumns) this.config.layout.columns = parseInt(layoutColumns.value);
        if (layoutRows) this.config.layout.rows = parseInt(layoutRows.value);

        // 更新轮播图配置
        const carouselImages = document.getElementById('carousel-images');
        const switchTime = document.getElementById('switch-time');
        const displayDuration = document.getElementById('display-duration');
        
        if (carouselImages) {
            this.config.carousel.images = carouselImages.value
                .split('\n')
                .map(url => url.trim())
                .filter(url => url.length > 0);
        }
        if (switchTime) this.config.carousel.switchTime = parseInt(switchTime.value);
        if (displayDuration) this.config.carousel.displayDuration = parseInt(displayDuration.value);

        // 更新图标配置
        const hideIconNameYes = document.querySelector('input[name="hide-icon-name"][value="true"]');
        const showIconShadowYes = document.querySelector('input[name="show-icon-shadow"][value="true"]');
        const enableAnimationYes = document.querySelector('input[name="enable-animation"][value="true"]');
        const showIconBackgroundYes = document.querySelector('input[name="show-icon-background"][value="true"]');
        const iconSize = document.getElementById('icon-size');
        
        if (hideIconNameYes) this.config.icon.hideName = hideIconNameYes.checked;
        if (showIconShadowYes) this.config.icon.showShadow = showIconShadowYes.checked;
        if (enableAnimationYes) this.config.icon.enableAnimation = enableAnimationYes.checked;
        if (showIconBackgroundYes) this.config.icon.showBackground = showIconBackgroundYes.checked;
        if (iconSize) this.config.icon.size = parseInt(iconSize.value);
        
        // 更新间距配置
        const containerPaddingVertical = document.getElementById('container-padding-vertical');
        const containerPaddingHorizontal = document.getElementById('container-padding-horizontal');
        const iconGap = document.getElementById('icon-gap');
        
        if (!this.config.spacing) {
            this.config.spacing = {};
        }
        if (containerPaddingVertical) this.config.spacing.containerPaddingVertical = parseInt(containerPaddingVertical.value);
        if (containerPaddingHorizontal) this.config.spacing.containerPaddingHorizontal = parseInt(containerPaddingHorizontal.value);
        if (iconGap) this.config.spacing.iconGap = parseInt(iconGap.value);
        
        // 更新Dock栏配置
        const dockBgColor = document.getElementById('dock-bg-color');
        const dockBgOpacity = document.getElementById('dock-bg-opacity');
        const dockBlur = document.getElementById('dock-blur');
        
        if (!this.config.dock) {
            this.config.dock = {};
        }
        if (dockBgColor) this.config.dock.backgroundColor = dockBgColor.value;
        if (dockBgOpacity) this.config.dock.backgroundOpacity = parseInt(dockBgOpacity.value);
        if (dockBlur) this.config.dock.blur = parseInt(dockBlur.value);
        
        // 更新窗口配置
        const windowBorderColor = document.getElementById('window-border-color');
        const windowTitleColor = document.getElementById('window-title-color');
        const windowHeaderBgColor = document.getElementById('window-header-bg-color');
        
        if (!this.config.window) {
            this.config.window = {};
        }
        if (windowBorderColor) this.config.window.borderColor = windowBorderColor.value;
        if (windowTitleColor) this.config.window.titleColor = windowTitleColor.value;
        if (windowHeaderBgColor) this.config.window.headerBackgroundColor = windowHeaderBgColor.value;
    }

    // 填充表单
    populateForm() {
        // 填充应用配置已在renderAppList中完成

        // 填充界面配置
        const showSettingsButtonYes = document.querySelector('input[name="show-settings-button"][value="true"]');
        const showSettingsButtonNo = document.querySelector('input[name="show-settings-button"][value="false"]');
        const showStatusBarYes = document.querySelector('input[name="show-status-bar"][value="true"]');
        const showStatusBarNo = document.querySelector('input[name="show-status-bar"][value="false"]');
        
        if (showSettingsButtonYes && showSettingsButtonNo) {
            if (this.config.interface.showSettingsButton) {
                showSettingsButtonYes.checked = true;
            } else {
                showSettingsButtonNo.checked = true;
            }
        }
        
        if (showStatusBarYes && showStatusBarNo) {
            if (this.config.interface.showStatusBar) {
                showStatusBarYes.checked = true;
            } else {
                showStatusBarNo.checked = true;
            }
        }

        // 填充背景配置
        const backgroundImage = document.getElementById('background-image');
        const overlayOpacity = document.getElementById('overlay-opacity');
        const overlayOpacityValue = document.getElementById('overlay-opacity-value');
        const backgroundBlur = document.getElementById('background-blur');
        const backgroundBlurValue = document.getElementById('background-blur-value');
        
        if (backgroundImage) backgroundImage.value = this.config.background.imageUrl;
        if (overlayOpacity) {
            overlayOpacity.value = this.config.background.overlayOpacity;
            overlayOpacityValue.textContent = this.config.background.overlayOpacity;
        }
        if (backgroundBlur) {
            backgroundBlur.value = this.config.background.blur;
            backgroundBlurValue.textContent = this.config.background.blur;
        }

        // 填充布局配置
        const layoutColumns = document.getElementById('layout-columns');
        const layoutRows = document.getElementById('layout-rows');
        
        if (layoutColumns) layoutColumns.value = this.config.layout.columns;
        if (layoutRows) layoutRows.value = this.config.layout.rows;

        // 填充轮播图配置
        const carouselImages = document.getElementById('carousel-images');
        const switchTime = document.getElementById('switch-time');
        const displayDuration = document.getElementById('display-duration');
        
        if (carouselImages) {
            carouselImages.value = this.config.carousel.images.join('\n');
        }
        if (switchTime) switchTime.value = this.config.carousel.switchTime;
        if (displayDuration) displayDuration.value = this.config.carousel.displayDuration;

        // 填充图标配置
        const hideIconNameYes = document.querySelector('input[name="hide-icon-name"][value="true"]');
        const hideIconNameNo = document.querySelector('input[name="hide-icon-name"][value="false"]');
        const showIconShadowYes = document.querySelector('input[name="show-icon-shadow"][value="true"]');
        const showIconShadowNo = document.querySelector('input[name="show-icon-shadow"][value="false"]');
        const enableAnimationYes = document.querySelector('input[name="enable-animation"][value="true"]');
        const enableAnimationNo = document.querySelector('input[name="enable-animation"][value="false"]');
        const showIconBackgroundYes = document.querySelector('input[name="show-icon-background"][value="true"]');
        const showIconBackgroundNo = document.querySelector('input[name="show-icon-background"][value="false"]');
        const iconSize = document.getElementById('icon-size');
        const iconSizeValue = document.getElementById('icon-size-value');
        
        if (hideIconNameYes && hideIconNameNo) {
            if (this.config.icon.hideName) {
                hideIconNameYes.checked = true;
            } else {
                hideIconNameNo.checked = true;
            }
        }
        
        if (showIconShadowYes && showIconShadowNo) {
            if (this.config.icon.showShadow) {
                showIconShadowYes.checked = true;
            } else {
                showIconShadowNo.checked = true;
            }
        }
        
        if (enableAnimationYes && enableAnimationNo) {
            if (this.config.icon.enableAnimation) {
                enableAnimationYes.checked = true;
            } else {
                enableAnimationNo.checked = true;
            }
        }
        
        if (showIconBackgroundYes && showIconBackgroundNo) {
            if (this.config.icon.showBackground) {
                showIconBackgroundYes.checked = true;
            } else {
                showIconBackgroundNo.checked = true;
            }
        }
        
        if (iconSize) {
            iconSize.value = this.config.icon.size;
            iconSizeValue.textContent = this.config.icon.size;
        }
        
        // 填充间距配置
        if (!this.config.spacing) {
            this.config.spacing = {
                containerPaddingVertical: 20,
                containerPaddingHorizontal: 20,
                iconGap: 20
            };
        }
        const containerPaddingVertical = document.getElementById('container-padding-vertical');
        const containerPaddingVerticalValue = document.getElementById('container-padding-vertical-value');
        const containerPaddingHorizontal = document.getElementById('container-padding-horizontal');
        const containerPaddingHorizontalValue = document.getElementById('container-padding-horizontal-value');
        const iconGap = document.getElementById('icon-gap');
        const iconGapValue = document.getElementById('icon-gap-value');
        
        if (containerPaddingVertical) {
            containerPaddingVertical.value = this.config.spacing.containerPaddingVertical;
            containerPaddingVerticalValue.textContent = this.config.spacing.containerPaddingVertical;
        }
        if (containerPaddingHorizontal) {
            containerPaddingHorizontal.value = this.config.spacing.containerPaddingHorizontal;
            containerPaddingHorizontalValue.textContent = this.config.spacing.containerPaddingHorizontal;
        }
        if (iconGap) {
            iconGap.value = this.config.spacing.iconGap;
            iconGapValue.textContent = this.config.spacing.iconGap;
        }
        
        // 填充Dock栏配置
        if (!this.config.dock) {
            this.config.dock = {
                backgroundColor: '#000000',
                backgroundOpacity: 50,
                blur: 20
            };
        }
        const dockBgColor = document.getElementById('dock-bg-color');
        const dockBgOpacity = document.getElementById('dock-bg-opacity');
        const dockBgOpacityValue = document.getElementById('dock-bg-opacity-value');
        const dockBlur = document.getElementById('dock-blur');
        const dockBlurValue = document.getElementById('dock-blur-value');
        
        if (dockBgColor) dockBgColor.value = this.config.dock.backgroundColor;
        if (dockBgOpacity) {
            dockBgOpacity.value = this.config.dock.backgroundOpacity;
            dockBgOpacityValue.textContent = this.config.dock.backgroundOpacity;
        }
        if (dockBlur) {
            dockBlur.value = this.config.dock.blur;
            dockBlurValue.textContent = this.config.dock.blur;
        }
        
        // 填充窗口配置
        if (!this.config.window) {
            this.config.window = {
                borderColor: '#ddd',
                titleColor: '#333',
                headerBackgroundColor: '#f5f5f5'
            };
        }
        const windowBorderColor = document.getElementById('window-border-color');
        const windowTitleColor = document.getElementById('window-title-color');
        const windowHeaderBgColor = document.getElementById('window-header-bg-color');
        
        if (windowBorderColor) windowBorderColor.value = this.config.window.borderColor;
        if (windowTitleColor) windowTitleColor.value = this.config.window.titleColor;
        if (windowHeaderBgColor) windowHeaderBgColor.value = this.config.window.headerBackgroundColor;

        // 绑定滑块值显示事件
        this.bindRangeValueDisplays();
    }

    // 绑定滑块值显示
    bindRangeValueDisplays() {
        const ranges = [
            { range: 'overlay-opacity', value: 'overlay-opacity-value' },
            { range: 'background-blur', value: 'background-blur-value' },
            { range: 'icon-size', value: 'icon-size-value' },
            { range: 'container-padding-vertical', value: 'container-padding-vertical-value' },
            { range: 'container-padding-horizontal', value: 'container-padding-horizontal-value' },
            { range: 'icon-gap', value: 'icon-gap-value' },
            { range: 'dock-bg-opacity', value: 'dock-bg-opacity-value' },
            { range: 'dock-blur', value: 'dock-blur-value' }
        ];

        ranges.forEach(({ range, value }) => {
            const rangeEl = document.getElementById(range);
            const valueEl = document.getElementById(value);
            
            if (rangeEl && valueEl) {
                rangeEl.addEventListener('input', () => {
                    valueEl.textContent = rangeEl.value;
                    this.onFieldChange();
                });
            }
        });
    }

    // 保存配置
    async saveConfig() {
        try {
            await electronAPI.saveConfig(this.config);
        } catch (error) {
            console.error('保存配置失败:', error);
            alert('保存配置失败: ' + error.message);
        }
    }

    // 恢复默认配置
    async resetConfig() {
        try {
            this.config = await electronAPI.resetConfig();
            this.renderAppList();
            this.populateForm();
            alert('已恢复默认配置');
        } catch (error) {
            console.error('恢复默认配置失败:', error);
            alert('恢复默认配置失败: ' + error.message);
        }
    }

    // 导出配置
    async exportConfig() {
        try {
            const success = await electronAPI.exportConfig();
            if (success) {
                alert('配置已导出');
            } else {
                alert('配置导出失败');
            }
        } catch (error) {
            console.error('导出配置失败:', error);
            alert('导出配置失败: ' + error.message);
        }
    }

    // 导入配置
    async importConfig(file) {
        try {
            const success = await electronAPI.importConfig(file.path);
            if (success) {
                this.config = await electronAPI.getConfig();
                this.renderAppList();
                this.populateForm();
                alert('配置已导入');
            } else {
                alert('配置导入失败');
            }
        } catch (error) {
            console.error('导入配置失败:', error);
            alert('导入配置失败: ' + error.message);
        }
    }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    window.settingsManager = new SettingsManager();
});
