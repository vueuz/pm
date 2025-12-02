// 应用数据存储
const appStore = {
    apps: [],
    openWindows: new Map(), // 存储打开的应用窗口
    activeWindow: null,     // 当前活动窗口
    config: {}              // 应用配置
};

// DOM 元素
let elements = {};
let currentUsername = '用户01'; // 默认用户名

// 视频播放状态
let videoState = {
    played: false,
    videoElement: null,
    containerElement: null
};

// 轮播图状态
let carouselState = {
    currentSlide: 0,
    totalSlides: 0,
    timer: null,
    progressTimer: null,
    startTime: null,
    displayDuration: 15000,
    switchTime: 3000,
    usedSlides: [] // 用于跟踪已播放的幻灯片索引，支持随机播放功能
};

// 初始化应用
document.addEventListener('DOMContentLoaded', () => {
    // 安全地获取DOM元素
    elements = {
        currentTime: document.getElementById('current-time'),
        launcherView: document.getElementById('launcher-view'),
        appWindowsContainer: document.getElementById('app-windows-container'),
        dockApps: document.getElementById('dock-apps'),
        homeButton: document.getElementById('home-button'),
        dockBar: document.getElementById('dock-bar'),
        downloadButton: document.getElementById('download-button'),
        downloadPanel: document.getElementById('download-panel'),
        dlList: document.getElementById('dl-list'),
        dlHistory: document.getElementById('dl-history'),
        historyToggle: document.getElementById('toggle-history'),
        dlCount: document.getElementById('dl-count'),
        closeDownloadPanel: document.getElementById('close-download-panel'),
        mainContent: document.getElementById('main-content'),
        carouselContainer: document.getElementById('carousel-container'),
        carouselSlides: document.getElementById('carousel-slides'),
        carouselIndicators: document.getElementById('carousel-indicators'),
        carouselProgress: document.getElementById('carousel-progress'),
        carouselProgressBar: document.getElementById('carousel-progress-bar'),
        videoContainer: document.getElementById('video-container'),
        initVideo: document.getElementById('init-video')
    };
    
    // 保存视频元素引用
    videoState.videoElement = elements.initVideo;
    videoState.containerElement = elements.videoContainer;
    
    initializeApp();
});

// 初始化应用
async function initializeApp() {
  // 获取系统用户名
  try {
    if (typeof electronAPI !== 'undefined' && electronAPI.getUsername) {
      currentUsername = await electronAPI.getUsername();
    }
  } catch (error) {
    console.warn('获取系统用户名失败，使用默认用户名:', error);
  }
  
  // 更新欢迎语
  updateWelcomeMessage();
  
  // 加载配置
  await loadConfig();
  
  // 检查是否需要播放启动视频
  if (shouldPlayInitVideo()) {
    await playInitVideo();
  } else {
    // 如果不播放视频，直接隐藏视频容器
    hideVideoContainer();
    // 检查是否需要显示轮播图
    if (shouldShowCarousel()) {
      await showCarousel();
    }
  }
  
  setupEventListeners();
  setupDownloadUI();
  loadDefaultApps();
  updateTime();
  
  // 启动定时器更新时间
  setInterval(updateTime, 1000);
  
  // 注册快捷键监听器
  registerShortcutListeners();
  
  // 监听窗口URL变化事件
  registerWindowUrlChangeListener();
  
  // 监听配置更新
  if (typeof electronAPI !== 'undefined' && electronAPI.onConfigUpdate) {
    electronAPI.onConfigUpdate((newConfig) => {
      console.log('配置已更新', newConfig);
      appStore.config = newConfig;
      appStore.apps = newConfig.apps.filter(app => app.visible);
      updateUIWithConfig();
      renderAppIcons();
    });
  }
}

// 更新欢迎语
function updateWelcomeMessage() {
    const welcomeElement = document.querySelector('#launcher-view h1');
    if (welcomeElement) {
        welcomeElement.textContent = `${currentUsername},您好`;
    }
}

// 加载配置
async function loadConfig() {
    try {
        if (typeof electronAPI !== 'undefined' && electronAPI.getConfig) {
            appStore.config = await electronAPI.getConfig();
            appStore.apps = appStore.config.apps.filter(app => app.visible);
            updateUIWithConfig();
        } else {
            console.warn('electronAPI不可用，使用默认配置');
            // 使用默认配置
            appStore.config = {
                apps: [
                    { id: 'baidu', name: '百度', url: 'https://www.baidu.com', icon: 'baidu.png', visible: true },
                    { id: 'bing', name: '必应', url: 'https://www.bing.com', icon: 'bing.png', visible: true },
                    { id: 'settings', name: '设置', url: 'settings/index.html', icon: 'settings.png', visible: true }
                ],
                interface: {
                    showSettingsButton: true,
                    showStatusBar: true
                },
                layout: {
                    columns: 8
                },
                icon: {
                    showShadow: true,
                    enableAnimation: true,
                    showBackground: true,
                    size: 100
                }
            };
            appStore.apps = appStore.config.apps.filter(app => app.visible);
            updateUIWithConfig();
        }
    } catch (error) {
        console.error('加载配置失败:', error);
    }
}

// 根据配置更新UI
function updateUIWithConfig() {
    // 更新布局
    const appsGrid = document.querySelector('.apps-grid');
    if (appsGrid && appStore.config.layout) {
        appsGrid.style.gridTemplateColumns = `repeat(${appStore.config.layout.columns}, minmax(120px, 1fr))`;
    }

    // 更新背景图片
    updateBackgroundImage();

    // 更新图标样式
    updateIconStyles();
    
    // 更新Dock栏样式
    updateDockStyles();
    
    // 更新窗口样式
    updateWindowStyles();
}

// 更新背景图片
function updateBackgroundImage() {
    const backgroundConfig = appStore.config.background;
    if (!backgroundConfig || !elements.mainContent) return;

    // 创建或获取背景层
    let backgroundLayer = document.getElementById('background-layer');
    if (!backgroundLayer) {
        backgroundLayer = document.createElement('div');
        backgroundLayer.id = 'background-layer';
        // 插入到 main-content 的最前面
        elements.mainContent.insertBefore(backgroundLayer, elements.mainContent.firstChild);
    }

    // 设置背景层样式
    backgroundLayer.style.position = 'absolute';
    backgroundLayer.style.zIndex = '0';
    backgroundLayer.style.pointerEvents = 'none';
    backgroundLayer.style.overflow = 'hidden';

    // 设置背景图片
    if (backgroundConfig.imageUrl) {
        // 计算模糊值来确定放大比例，防止白边
        const blurValue = backgroundConfig.blur !== undefined ? backgroundConfig.blur : 0;
        // 增加放大系数，确保模糊边缘完全超出可视区域
        const offset = blurValue * 2; // 偏移量是模糊值的2倍
        
        // 通过负偏移和放大尺寸来隐藏模糊白边
        backgroundLayer.style.top = `-${offset}px`;
        backgroundLayer.style.left = `-${offset}px`;
        backgroundLayer.style.width = `calc(100% + ${offset * 2}px)`;
        backgroundLayer.style.height = `calc(100% + ${offset * 2}px)`;
        
        backgroundLayer.style.backgroundImage = `url('${backgroundConfig.imageUrl}')`;
        backgroundLayer.style.backgroundRepeat = 'no-repeat';
        backgroundLayer.style.backgroundPosition = 'center center';
        backgroundLayer.style.backgroundSize = 'cover';
        
        // 应用高斯模糊效果到背景层
        backgroundLayer.style.filter = `blur(${blurValue}px)`;
        backgroundLayer.style.transition = 'filter 0.3s ease';
    } else {
        // 没有背景图片时恢复默认位置和尺寸
        backgroundLayer.style.top = '0';
        backgroundLayer.style.left = '0';
        backgroundLayer.style.width = '100%';
        backgroundLayer.style.height = '100%';
    }

    // 创建遮罩层
    let overlay = document.getElementById('background-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'background-overlay';
        // 插入到背景层之后
        if (backgroundLayer.nextSibling) {
            elements.mainContent.insertBefore(overlay, backgroundLayer.nextSibling);
        } else {
            elements.mainContent.appendChild(overlay);
        }
    }

    // 设置遮罩层样式
    overlay.style.position = 'absolute';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.backgroundColor = 'white';
    overlay.style.opacity = backgroundConfig.overlayOpacity !== undefined ? 
        (backgroundConfig.overlayOpacity / 100) : 0.3;
    overlay.style.zIndex = '1';
    overlay.style.pointerEvents = 'none';
}

// 更新图标样式
function hexToRgba(hex, opacity) {
    const h = hex.replace('#', '');
    const bigint = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

function updateIconStyles() {
    // 移除之前的样式
    let style = document.getElementById('dynamic-icon-styles');
    if (!style) {
        style = document.createElement('style');
        style.id = 'dynamic-icon-styles';
        document.head.appendChild(style);
    }

    const iconConfig = appStore.config.icon;
    const spacingConfig = appStore.config.spacing || {
        containerPaddingVertical: 20,
        containerPaddingHorizontal: 20,
        iconGap: 20
    };
    let css = '';

    if (iconConfig) {
        // 图标尺寸
        css += `.app-icon { transform: scale(${iconConfig.size / 100}); transform-origin: center top; }`;

        // 图标阴影
        if (iconConfig.showShadow) {
            css += `.app-icon { box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1); }`;
            css += `.app-icon:hover { box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2); }`;
        } else {
            css += `.app-icon { box-shadow: none; }`;
        }

        // 过渡动画
        if (iconConfig.enableAnimation) {
            css += `.app-icon { transition: all 0.2s ease; }`;
        } else {
            css += `.app-icon { transition: none; }`;
        }

        // 图标背景
        if (!iconConfig.showBackground) {
            css += `.app-icon { background-color: transparent; }`;
        }

        // 图标名称
        if (iconConfig.hideName) {
            css += `.app-icon span { display: none; }`;
        }

        const glow = (iconConfig.glow) ? iconConfig.glow : {
            enabled: true,
            color: '#370890ff',
            opacity: 0.24,
            blur: 14,
            height: 10,
            spread: 30
        };
        if (glow && glow.enabled) {
            const rgba = hexToRgba(glow.color || '#ff2414ff', glow.opacity !== undefined ? glow.opacity : 0.65);
            const spread = glow.spread || 60;
            const blur = glow.blur !== undefined ? glow.blur : 100;
            const inner = glow.height !== undefined ? Math.max(15, Math.min(60, glow.height * 2)) : 30;
            const fadeInMs = glow.fadeInMs !== undefined ? glow.fadeInMs : 500;
            css += `.app-icon { position: relative; }`;
            css += `.app-icon .icon-graphic { position: relative; z-index: 1; }`;
            css += `.app-icon .icon-graphic::before { content: ''; position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); width: calc(100% + ${spread}px); height: calc(100% + ${spread}px); border-radius: 50%; pointer-events: none; background: radial-gradient(circle at center, ${rgba} 0%, ${rgba} ${inner}%, transparent 85%); filter: blur(${blur}px); opacity: 0; z-index: 0; transition: opacity ${fadeInMs}ms ease; }`;
            css += `@keyframes glowPulse { 0% { opacity: 1; } 100% { opacity: 0.6; } }`;
            css += `.app-icon:hover .icon-graphic::before { opacity: 1; animation: glowPulse 4s ease-in-out 1s infinite alternate; }`;
        }
    }
    
    // 应用间距配置
    css += `.apps-grid { 
        padding: ${spacingConfig.containerPaddingVertical}px ${spacingConfig.containerPaddingHorizontal}px; 
        gap: ${spacingConfig.iconGap}px; 
    }`;

    style.textContent = css;
}

// 更新Dock栏样式
function updateDockStyles() {
    const dockBar = document.getElementById('dock-bar');
    if (!dockBar) return;
    
    const dockConfig = appStore.config.dock || {
        backgroundColor: '#000000',
        backgroundOpacity: 50,
        blur: 20
    };
    
    // 计算背景颜色和透明度
    const bgColor = dockConfig.backgroundColor || '#000000';
    const opacity = (dockConfig.backgroundOpacity || 50) / 100;
    const blur = dockConfig.blur || 20;
    
    // 应用样式
    dockBar.style.backgroundColor = `${bgColor}${Math.round(opacity * 255).toString(16).padStart(2, '0')}`;
    dockBar.style.backdropFilter = `blur(${blur}px)`;
    dockBar.style.webkitBackdropFilter = `blur(${blur}px)`;
}

// 更新窗口样式
function updateWindowStyles() {
    // 移除之前的样式
    let style = document.getElementById('dynamic-window-styles');
    if (!style) {
        style = document.createElement('style');
        style.id = 'dynamic-window-styles';
        document.head.appendChild(style);
    }

    const windowConfig = appStore.config.window || {
        borderColor: '#ddd',
        titleColor: '#333',
        headerBackgroundColor: '#f5f5f5'
    };
    
    console.log('应用窗口样式配置:', windowConfig);
    
    let css = '';
    
    // 窗口标题栏背景颜色 - 使用!important确保优先级
    css += `.window-header { background-color: ${windowConfig.headerBackgroundColor} !important; }`;
    
    // 窗口边框颜色 - 使用!important确保优先级
    css += `.window-header { border-bottom: 1px solid ${windowConfig.borderColor} !important; }`;
    
    // 窗口标题文字颜色 - 使用!important确保优先级
    css += `.window-title { color: ${windowConfig.titleColor} !important; }`;

    style.textContent = css;
    
    // 对已存在的窗口也应用样式
    document.querySelectorAll('.window-header').forEach(header => {
        header.style.backgroundColor = windowConfig.headerBackgroundColor;
        header.style.borderBottom = `1px solid ${windowConfig.borderColor}`;
    });
    document.querySelectorAll('.window-title').forEach(title => {
        title.style.color = windowConfig.titleColor;
    });
}

// 设置事件监听器
function setupEventListeners() {
    // 应用图标点击事件
    document.addEventListener('click', (event) => {
        if (event.target.closest('.app-icon')) {
            handleAppIconClick(event);
        }
    }, true);
    
    // 主页按钮点击事件
    if (elements.homeButton) {
        elements.homeButton.addEventListener('click', showLauncherView);
    }
}

// ========== 下载面板与提示 ==========
const downloadItems = new Map();
let hasUnreadDownloads = false;

function setupDownloadUI() {
  if (elements.downloadButton) {
    elements.downloadButton.addEventListener('click', toggleDownloadPanel);
  }
  if (elements.closeDownloadPanel) {
    elements.closeDownloadPanel.addEventListener('click', hideDownloadPanel);
  }
  document.addEventListener('click', (e) => {
    const withinPanel = elements.downloadPanel && elements.downloadPanel.contains(e.target);
    const onButton = elements.downloadButton && elements.downloadButton.contains(e.target);
    if (!withinPanel && !onButton) hideDownloadPanel();
  });

  if (window.downloadsAPI) {
    window.downloadsAPI.windowReady();
    window.downloadsAPI.onStart((data) => { updateDownloadItem(data); updateDockProgress(data); });
    window.downloadsAPI.onProgress((data) => { updateDownloadItem(data); updateDockProgress(data); });
    window.downloadsAPI.onComplete((data) => {
      updateDownloadItem(data);
      updateDockProgress(data);
      if (elements.downloadPanel && elements.downloadPanel.classList.contains('hidden')) {
        toggleDownloadPanel();
      }
    });
    window.downloadsAPI.onCancelled(updateDownloadItem);
    window.downloadsAPI.onList(({ list, history }) => {
      list.forEach(d => updateDownloadItem(d));
      renderHistory(history);
    });
  }

  if (elements.historyToggle && elements.dlHistory) {
    elements.dlHistory.classList.add('collapsed');
    elements.historyToggle.addEventListener('click', () => {
      const isCollapsed = elements.dlHistory.classList.contains('collapsed');
      if (isCollapsed) {
        elements.dlHistory.classList.remove('collapsed');
        elements.historyToggle.classList.add('expanded');
      } else {
        elements.dlHistory.classList.add('collapsed');
        elements.historyToggle.classList.remove('expanded');
      }
    });
  }

  
}

function toggleDownloadPanel() {
  if (!elements.downloadPanel || !elements.downloadButton) return;
  if (!elements.downloadPanel.classList.contains('hidden')) {
    hideDownloadPanel();
    return;
  }

  const panel = elements.downloadPanel;
  const buttonRect = elements.downloadButton.getBoundingClientRect();
  const dockRect = elements.dockBar.getBoundingClientRect();
  const margin = 6;
  const panelWidth = 420;

  // Center panel horizontally above the button
  let left = Math.round(buttonRect.left + buttonRect.width / 2 - panelWidth / 2);
  // Clamp to screen edges
  left = Math.max(margin, Math.min(left, window.innerWidth - panelWidth - margin));

  // Position panel vertically, 2px above the dock
  const bottom = window.innerHeight - dockRect.top + 2;

  panel.style.left = `${left}px`;
  panel.style.width = `${panelWidth}px`;
  panel.style.maxHeight = `${Math.round(window.innerHeight * 0.56)}px`;
  panel.style.bottom = `${bottom}px`;
  panel.style.top = 'auto'; // Ensure top is not set

  panel.classList.remove('hidden');

  // Clear unread indicator
  hasUnreadDownloads = false;
  if (elements.downloadButton) {
    elements.downloadButton.classList.remove('has-unread');
  }
}

function hideDownloadPanel() {
  if (elements.downloadPanel) elements.downloadPanel.classList.add('hidden');
}

function fmtSize(bytes) {
  if (!bytes && bytes !== 0) return '--';
  const units = ['B','KB','MB','GB','TB'];
  let i = 0; let b = bytes;
  while (b >= 1024 && i < units.length - 1) { b /= 1024; i++; }
  return `${b.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function updateDownloadItem(data) {
  downloadItems.set(data.id, data);
  if (!elements.dlList) return;
  let row = document.getElementById(`dl-${data.id}`);
  if (!row) {
    row = document.createElement('div');
    row.className = 'download-item';
    row.id = `dl-${data.id}`;
    const meta = document.createElement('div'); meta.className = 'download-meta';
    const name = document.createElement('div'); name.className = 'download-name';
    const stats = document.createElement('div'); stats.className = 'download-stats';
    const bar = document.createElement('div'); bar.className = 'download-bar';
    const barInner = document.createElement('div'); bar.appendChild(barInner);
    meta.appendChild(name); meta.appendChild(stats); meta.appendChild(bar);
    const actions = document.createElement('div'); actions.className = 'download-actions';
    const openBtn = document.createElement('button'); openBtn.className = 'download-btn'; openBtn.textContent = '打开文件'; openBtn.onclick = () => window.downloadsAPI && window.downloadsAPI.openFile(data.id);
    const folderBtn = document.createElement('button'); folderBtn.className = 'download-btn'; folderBtn.textContent = '打开文件夹'; folderBtn.onclick = () => window.downloadsAPI && window.downloadsAPI.openFolder(data.id);
    actions.appendChild(openBtn); actions.appendChild(folderBtn);
    row.appendChild(meta); row.appendChild(actions);
    elements.dlList.appendChild(row);
    elements.dlList.scrollTop = elements.dlList.scrollHeight;
  }
  const nameEl = row.querySelector('.download-name');
  const statsEl = row.querySelector('.download-stats');
  const barInnerEl = row.querySelector('.download-bar > div');
  const barEl = row.querySelector('.download-bar');
  nameEl.textContent = data.filename;
  const pct = data.totalBytes > 0 ? Math.floor((data.receivedBytes / data.totalBytes) * 100) : 0;
  if (data.state === 'downloading') {
    if(barEl) barEl.style.display = 'block';
    barInnerEl.style.width = `${pct}%`;
    const speedStr = data.speed ? `${fmtSize(data.speed)}/s` : '--';
    statsEl.textContent = `${fmtSize(data.receivedBytes)} / ${fmtSize(data.totalBytes)} · ${speedStr}`;
  } else {
    if(barEl) barEl.style.display = 'none';
    statsEl.textContent = `${fmtSize(data.totalBytes)} · ${data.state === 'completed' ? '已完成' : '已取消'}`;
  }
  if (elements.dlCount) elements.dlCount.textContent = `共 ${downloadItems.size} 项`;
}

function renderHistory(items) {
  if (!elements.dlHistory) return;
  elements.dlHistory.innerHTML = '';
  items.forEach(d => {
    const row = document.createElement('div'); row.className = 'download-item';
    const meta = document.createElement('div'); meta.className = 'download-meta';
    const name = document.createElement('div'); name.className = 'download-name'; name.textContent = d.filename;
    const stats = document.createElement('div'); stats.className = 'download-stats'; stats.textContent = `${fmtSize(d.totalBytes)} · ${d.state === 'completed' ? '已完成' : '已取消'}`;
    meta.appendChild(name); meta.appendChild(stats);
    const actions = document.createElement('div'); actions.className = 'download-actions';
    row.appendChild(meta);
    const s = String(d.filename || '').toLowerCase();
    const i = s.lastIndexOf('.');
    const e = i >= 0 ? s.slice(i + 1) : '';
    const isDoc = ['doc','docx','ppt','pptx','xls','xlsx','pdf'].includes(e);
    if (isDoc) {
      const openBtn = document.createElement('button');
      openBtn.className = 'download-btn';
      openBtn.textContent = '打开文件';
      openBtn.onclick = () => window.downloadsAPI && window.downloadsAPI.openFile(d.id);
      actions.appendChild(openBtn);
    } else {
      const disabledBtn = document.createElement('button');
      disabledBtn.className = 'download-btn';
      disabledBtn.textContent = '不支持在专业模式打开';
      disabledBtn.disabled = true;
      actions.appendChild(disabledBtn);
    }
    row.appendChild(actions);
    elements.dlHistory.appendChild(row);
  });
}

 

// 加载默认应用
function loadDefaultApps() {
    // 这里可以加载本地存储的应用列表
    renderDockApps();
    renderAppIcons();
}

// 渲染应用图标
function renderAppIcons() {
    const appsGrid = document.querySelector('.apps-grid');
    if (!appsGrid) return;

    appsGrid.innerHTML = '';
    
    appStore.apps.forEach(app => {
        const appIcon = document.createElement('div');
        appIcon.className = 'app-icon';
        appIcon.dataset.app = app.id;
        
        // 使用默认图标或从配置中获取
        const iconPath = app.icon ? `assets/icons/${app.icon}` : '';
        const initials = app.name.substring(0, 2); // 前两个字符作为默认图标
        
        if (iconPath) {
            appIcon.innerHTML = `
                <div class="icon-graphic">
                    <img src="${iconPath}" alt="${app.name}" onerror="this.style.display='none';this.parentElement.querySelector('.default-icon').style.display='flex';">
                    <div class="default-icon" style="display:none;">${initials}</div>
                </div>
                <span>${app.name}</span>
            `;
        } else {
            // 使用文字作为默认图标
            appIcon.innerHTML = `
                <div class="icon-graphic">
                    <div class="default-icon">${initials}</div>
                </div>
                <span>${app.name}</span>
            `;
        }
        
        appsGrid.appendChild(appIcon);
    });
    
    // 添加设置图标
    if (appStore.config.interface.showSettingsButton) {
        const settingsIcon = document.createElement('div');
        settingsIcon.className = 'app-icon';
        settingsIcon.dataset.app = 'settings';
        settingsIcon.innerHTML = `
            <img src="assets/icons/settings.png" alt="设置" onerror="this.style.display='none';">
            <span>设置</span>
        `;
        appsGrid.appendChild(settingsIcon);
    }
}

// 渲染 Dock 应用
function renderDockApps() {
    if (!elements.dockApps) return;
    
    elements.dockApps.innerHTML = '';
    
    appStore.openWindows.forEach((windowData, appId) => {
        const app = appStore.apps.find(a => a.id === appId);
        if (app) {
            const dockItem = document.createElement('div');
            dockItem.className = `dock-item ${appStore.activeWindow === appId ? 'active' : ''}`;
            dockItem.dataset.app = appId;
            
            const iconPath = app.icon ? `assets/icons/${app.icon}` : '';
            if (iconPath) {
                const img = document.createElement('img');
                img.src = iconPath;
                img.alt = app.name;
                img.onerror = function() { 
                    this.style.display = 'none'; 
                    const defaultIcon = this.parentElement.querySelector('.default-dock-icon');
                    if (defaultIcon) defaultIcon.style.display = 'flex';
                };
                dockItem.appendChild(img);
                
                // 添加默认图标作为后备
                const defaultIcon = document.createElement('div');
                defaultIcon.className = 'default-dock-icon';
                defaultIcon.textContent = app.name.substring(0, 2);
                defaultIcon.style.display = 'none';
                dockItem.appendChild(defaultIcon);
            } else {
                // 默认图标
                const initials = app.name.substring(0, 2);
                dockItem.innerHTML = `<div class="default-dock-icon">${initials}</div>`;
            }
            
    // 不显示悬停提示
            
            dockItem.addEventListener('click', () => toggleAppWindow(appId));
            elements.dockApps.appendChild(dockItem);
        }
    });
    
    // 不显示主页按钮的悬停提示
}

// 处理应用图标点击
async function handleAppIconClick(event) {
    const appIcon = event.target.closest('.app-icon');
    const appId = appIcon.dataset.app;
    
    if (appId === 'settings') {
        const settingsApp = {
            id: 'settings',
            name: '设置',
            url: 'settings/index.html',
            type: 'web',
            icon: 'settings.png',
            visible: true
        };
        openAppWindow(settingsApp);
        return;
    }
    
    const app = appStore.apps.find(a => a.id === appId);
    if (!app) return;
    
    // 检查应用URL，处理特殊操作
    if (app.url === '#quit') {
        // 退出整个应用
        if (typeof electronAPI !== 'undefined' && electronAPI.quitApp) {
            electronAPI.quitApp();
        } else {
            window.close();
        }
        return;
    }
    
    // 处理其他特殊应用
    switch (appId) {
        case 'quit-app':
        case 'shutdown':
            // 退出整个应用
            if (typeof electronAPI !== 'undefined' && electronAPI.quitApp) {
                electronAPI.quitApp();
            } else {
                window.close();
            }
            break;
        default:
            openAppWindow(app);
    }
}

// 打开应用窗口
function openAppWindow(app) {
    // 如果窗口已经打开，则激活它
    if (appStore.openWindows.has(app.id)) {
        const windowData = appStore.openWindows.get(app.id);
        // 如果窗口是最小化的，需要先恢复它
        if (windowData.minimized) {
            activateAppWindow(app.id);
        } else {
            // 窗口已经打开且未最小化，将其设为活动窗口
            appStore.activeWindow = app.id;
            windowData.element.style.zIndex = '2';
            
            // 取消激活其他窗口
            appStore.openWindows.forEach((data, id) => {
                if (id !== app.id) {
                    data.element.style.zIndex = '1';
                }
            });
            
            // 隐藏启动器视图
            if (elements.launcherView) {
                elements.launcherView.classList.remove('active');
            }
            renderDockApps();
        }
        return;
    }
    
    // 创建新的应用窗口
    const windowElement = document.createElement('div');
    windowElement.className = 'app-window';
    windowElement.id = `app-window-${app.id}`;
    
    // 创建窗口头部
    const header = document.createElement('div');
    header.className = 'window-header';
    
    // 应用窗口配置的样式
    const windowConfig = appStore.config.window || { 
        borderColor: '#ddd', 
        titleColor: '#333',
        headerBackgroundColor: '#f5f5f5'
    };
    header.style.backgroundColor = windowConfig.headerBackgroundColor;
    header.style.borderBottom = `1px solid ${windowConfig.borderColor}`;
    
    const title = document.createElement('div');
    title.className = 'window-title';
    title.textContent = app.name;
    
    // 应用窗口配置的标题颜色
    title.style.color = windowConfig.titleColor;
    
    const controls = document.createElement('div');
    controls.className = 'window-controls';
    
    const minimizeBtn = document.createElement('button');
    minimizeBtn.className = 'window-btn minimize';
    minimizeBtn.innerHTML = '−';
    minimizeBtn.addEventListener('click', () => minimizeAppWindow(app.id));
    
    const closeBtn = document.createElement('button');
    closeBtn.className = 'window-btn close';
    closeBtn.innerHTML = '×';
    closeBtn.addEventListener('click', () => closeAppWindow(app.id));
    
    controls.appendChild(minimizeBtn);
    controls.appendChild(closeBtn);
    
    header.appendChild(title);
    header.appendChild(controls);
    
    // 创建窗口内容区域
    const content = document.createElement('div');
    content.className = 'window-content';
    
    // 根据应用类型显示不同内容
    const appType = app.type || 'web'; // 默认为web类型
    
    if (appType === 'web') {
        if (app.url && app.url !== '#') {
            const isHttp = /^https?:/i.test(app.url);
            if (isHttp) {
                const webview = document.createElement('webview');
                webview.src = app.url;
                webview.setAttribute('partition', 'persist:default');
                webview.setAttribute('allowpopups', '');
                webview.style.width = '100%';
                webview.style.height = '100%';
                content.appendChild(webview);
            } else {
                const iframe = document.createElement('iframe');
                iframe.src = app.url;
                iframe.title = app.name;
                iframe.sandbox = 'allow-scripts allow-same-origin allow-forms allow-popups allow-top-navigation';
                iframe.addEventListener('load', () => {
                    try {
                        if (app.id === 'settings' && typeof electronAPI !== 'undefined') {
                            iframe.contentWindow.electronAPI = electronAPI;
                        }
                    } catch (e) {}
                });
                content.appendChild(iframe);
            }
        } else {
            content.innerHTML = `<div style="padding: 20px;">${app.name} 内容区域</div>`;
        }
    } else if (appType === 'image') {
        // 图片应用：显示图片
        content.classList.add('image-content');
        const img = document.createElement('img');
        img.src = app.url || app.path;
        img.alt = app.name;
        img.className = 'app-image';
        content.appendChild(img);
    } else if (appType === 'local') {
        // 本地应用：启动本地可执行文件
        const launchMessage = document.createElement('div');
        launchMessage.className = 'launch-message';
        launchMessage.innerHTML = `<p>正在启动 ${app.name}...</p>`;
        content.appendChild(launchMessage);
        
        // 调用electron API启动本地应用
        if (typeof electronAPI !== 'undefined' && electronAPI.launchLocalApp) {
            electronAPI.launchLocalApp(app.path).then(result => {
                if (result.success) {
                    launchMessage.innerHTML = `<p>${app.name} 已启动</p><p class="hint">应用在独立窗口中运行</p>`;
                } else {
                    launchMessage.innerHTML = `<p>启动失败：${result.error}</p>`;
                }
            }).catch(error => {
                launchMessage.innerHTML = `<p>启动失败：${error.message}</p>`;
            });
        } else {
            launchMessage.innerHTML = `<p>当前环境不支持启动本地应用</p>`;
        }
    }
    
    windowElement.appendChild(header);
    windowElement.appendChild(content);
    
    if (elements.appWindowsContainer) {
        elements.appWindowsContainer.appendChild(windowElement);
    }
    
    // 添加到存储中
    appStore.openWindows.set(app.id, {
        element: windowElement,
        app: app,
        minimized: false
    });
    
    // 设置为活动窗口
    appStore.activeWindow = app.id;
    
    // 隐藏启动器视图
    if (elements.launcherView) {
        elements.launcherView.classList.remove('active');
    }
    
    // 更新 Dock
    renderDockApps();
}

// 最小化应用窗口
function minimizeAppWindow(appId) {
    const windowData = appStore.openWindows.get(appId);
    if (windowData) {
        windowData.element.classList.add('minimized');
        windowData.minimized = true;
        if (appStore.activeWindow === appId) {
            appStore.activeWindow = null;
            if (elements.launcherView) {
                elements.launcherView.classList.add('active');
            }
        }
        renderDockApps();
    }
}

// 关闭应用窗口
function closeAppWindow(appId) {
    const windowData = appStore.openWindows.get(appId);
    if (windowData) {
        windowData.element.remove();
        appStore.openWindows.delete(appId);
        
        if (appStore.activeWindow === appId) {
            appStore.activeWindow = null;
            if (elements.launcherView) {
                elements.launcherView.classList.add('active');
            }
        }
        
        renderDockApps();
    }
}

// 切换应用窗口（激活或取消激活）
function toggleAppWindow(appId) {
    const windowData = appStore.openWindows.get(appId);
    if (!windowData) return;
    
    if (windowData.minimized) {
        activateAppWindow(appId);
    } else if (appStore.activeWindow === appId) {
        minimizeAppWindow(appId);
    } else {
        activateAppWindow(appId);
    }
}

// 激活应用窗口
function activateAppWindow(appId) {
    const windowData = appStore.openWindows.get(appId);
    if (!windowData) return;
    
    // 取消激活当前窗口
    if (appStore.activeWindow && appStore.activeWindow !== appId) {
        const currentWindowData = appStore.openWindows.get(appStore.activeWindow);
        if (currentWindowData) {
            currentWindowData.element.style.zIndex = '1';
        }
    }
    
    // 激活新窗口
    windowData.element.classList.remove('minimized');
    windowData.element.style.zIndex = '2';
    windowData.minimized = false;
    appStore.activeWindow = appId;
    
    // 隐藏启动器视图
    if (elements.launcherView) {
        elements.launcherView.classList.remove('active');
    }
    
    renderDockApps();
}

// 显示启动器视图
function showLauncherView() {
    if (elements.launcherView) {
        elements.launcherView.classList.add('active');
    }
    appStore.activeWindow = null;
    
    // 将所有窗口置于较低层级
    appStore.openWindows.forEach(windowData => {
        windowData.element.style.zIndex = '1';
    });
    
    renderDockApps();
}

// 更新时间显示
function updateTime() {
    const now = new Date();
    if (elements.currentTime) {
        elements.currentTime.textContent = now.toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        }).replace(/\//g, '-');
    }
}

// ========== 轮播图相关功能 ==========

// 判断是否播放启动视频
function shouldPlayInitVideo() {
    // 检查视频文件是否存在且配置中启用
    const videoConfig = appStore.config.initVideo;
    if (!videoConfig || videoConfig.enabled === false) {
        return false;
    }
    
    // 检查是否已经播放过（可选）
    if (videoState.played) {
        return false;
    }
    
    return true;
}

// 播放启动视频
async function playInitVideo() {
    return new Promise((resolve) => {
        const video = videoState.videoElement;
        const container = videoState.containerElement;
        
        if (!video || !container) {
            console.warn('视频元素不存在');
            resolve();
            return;
        }
        
        // 显示视频容器
        container.classList.remove('hidden');
        
        // 检查是否允许跳过，并显示/隐藏提示
        const videoConfig = appStore.config.initVideo;
        const skipHint = document.getElementById('skip-hint');
        if (skipHint) {
            if (videoConfig && videoConfig.allowSkip !== false) {
                skipHint.style.display = 'block';
            } else {
                skipHint.style.display = 'none';
            }
        }
        
        // 设置视频跳过标识
        let videoSkipped = false;
        
        // 添加ESC键跳过功能
        const handleEscKey = (e) => {
            // 检查是否允许跳过
            const videoConfig = appStore.config.initVideo;
            if (videoConfig && videoConfig.allowSkip !== false && e.key === 'Escape') {
                if (!videoSkipped) {
                    videoSkipped = true;
                    skipInitVideo();
                }
            }
        };
        
        // 跳过视频函数
        const skipInitVideo = async () => {
            // 移除键盘监听
            document.removeEventListener('keydown', handleEscKey);
            
            // 停止视频播放
            video.pause();
            videoState.played = true;
            
            // 隐藏视频容器
            hideVideoContainer();
            
            // 播放完成后显示轮播图
            if (shouldShowCarousel()) {
                await showCarousel();
            }
            
            resolve();
        };
        
        // 添加键盘监听
        document.addEventListener('keydown', handleEscKey);
        
        // 监听视频播放结束事件
        video.addEventListener('ended', async () => {
            if (!videoSkipped) {
                // 移除键盘监听
                document.removeEventListener('keydown', handleEscKey);
                
                videoState.played = true;
                // 隐藏视频容器
                hideVideoContainer();
                
                // 播放完成后显示轮播图
                if (shouldShowCarousel()) {
                    await showCarousel();
                }
                
                resolve();
            }
        }, { once: true });
        
        // 监听视频加载错误
        video.addEventListener('error', (e) => {
            if (!videoSkipped) {
                // 移除键盘监听
                document.removeEventListener('keydown', handleEscKey);
                
                console.error('视频加载失败:', e);
                hideVideoContainer();
                
                // 视频加载失败后直接显示轮播图
                if (shouldShowCarousel()) {
                    showCarousel();
                }
                
                resolve();
            }
        }, { once: true });
        
        // 尝试播放视频
        video.play().catch((error) => {
            if (!videoSkipped) {
                // 移除键盘监听
                document.removeEventListener('keydown', handleEscKey);
                
                console.error('视频播放失败:', error);
                hideVideoContainer();
                
                // 播放失败后直接显示轮播图
                if (shouldShowCarousel()) {
                    showCarousel();
                }
                
                resolve();
            }
        });
    });
}

// 隐藏视频容器
function hideVideoContainer() {
    const container = videoState.containerElement;
    if (container) {
        container.classList.add('hidden');
        
        // 延迟移除DOM元素，等待动画完成
        setTimeout(() => {
            if (container) {
                container.style.display = 'none';
            }
        }, 500);
    }
}

// 判断是否显示轮播图
function shouldShowCarousel() {
    const carouselConfig = appStore.config.carousel;
    if (!carouselConfig || carouselConfig.enabled === false) {
        return false;
    }
    if (!carouselConfig.images || carouselConfig.images.length === 0) {
        return false;
    }
    return true;
}

// 显示轮播图
async function showCarousel() {
    const carouselConfig = appStore.config.carousel;
    if (!carouselConfig || carouselConfig.enabled === false) {
        hideCarousel();
        return;
    }
    if (!carouselConfig.images || carouselConfig.images.length === 0) {
        hideCarousel();
        return;
    }

    // 设置轮播图参数
    carouselState.totalSlides = carouselConfig.images.length;
    carouselState.displayDuration = carouselConfig.displayDuration || 15000;
    carouselState.switchTime = carouselConfig.switchTime || 3000;
    
    // 重置已播放的幻灯片记录，确保每次显示轮播图时都是全新的随机播放
    carouselState.usedSlides = [];
    
    // 如果启用随机播放，随机选择第一张幻灯片
    const isRandomMode = carouselConfig.random === true;
    if (isRandomMode && carouselState.totalSlides > 1) {
        carouselState.currentSlide = Math.floor(Math.random() * carouselState.totalSlides);
        // 记录已播放的第一张幻灯片
        carouselState.usedSlides.push(carouselState.currentSlide);
    } else {
        carouselState.currentSlide = 0;
    }

    // 渲染轮播图
    renderCarouselSlides(carouselConfig.images);
    renderCarouselIndicators();

    // 显示轮播图容器
    if (elements.carouselContainer) {
        elements.carouselContainer.classList.remove('hidden');
    }

    // 启动轮播
    startCarousel();
}

// 渲染轮播图幻灯片
function renderCarouselSlides(images) {
    if (!elements.carouselSlides) return;

    elements.carouselSlides.innerHTML = '';

    images.forEach((imageUrl, index) => {
        const slide = document.createElement('div');
        slide.className = 'carousel-slide';
        
        // 创建一个预加载图片来检查图片是否有效
        const img = new Image();
        img.onload = function() {
            slide.style.backgroundImage = `url('${imageUrl}')`;
        };
        img.onerror = function() {
            // 如果图片加载失败，显示占位符
            slide.style.backgroundColor = '#333';
            slide.innerHTML = '<div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); color: #999; font-size: 18px;">图片加载失败</div>';
        };
        img.src = imageUrl;
        
        if (index === carouselState.currentSlide) {
            slide.classList.add('active');
        }
        elements.carouselSlides.appendChild(slide);
    });
}

// 渲染轮播图指示器
function renderCarouselIndicators() {
    if (!elements.carouselIndicators) return;

    elements.carouselIndicators.innerHTML = '';

    for (let i = 0; i < carouselState.totalSlides; i++) {
        const indicator = document.createElement('div');
        indicator.className = 'carousel-indicator';
        if (i === carouselState.currentSlide) {
            indicator.classList.add('active');
        }
        indicator.addEventListener('click', () => goToSlide(i));
        elements.carouselIndicators.appendChild(indicator);
    }
}

// 启动轮播
 function startCarousel() {
    carouselState.startTime = Date.now();
    
    // 启动进度条
    startProgressBar();
    
    // 启动自动轮播
    carouselState.timer = setInterval(() => {
        nextSlide();
    }, carouselState.switchTime);
    
    // 在总显示时间后隐藏轮播图
    setTimeout(() => {
        hideCarousel();
    }, carouselState.displayDuration);
}

// 启动进度条
function startProgressBar() {
    if (!elements.carouselProgressBar) return;
    
    const updateProgress = () => {
        const elapsed = Date.now() - carouselState.startTime;
        const progress = Math.min((elapsed / carouselState.displayDuration) * 100, 100);
        elements.carouselProgressBar.style.width = `${progress}%`;
        
        if (progress < 100) {
            carouselState.progressTimer = requestAnimationFrame(updateProgress);
        }
    };
    
    updateProgress();
}

// 下一张幻灯片
function nextSlide() {
    // 检查是否启用随机播放
    const carouselConfig = appStore.config.carousel || {};
    const isRandomMode = carouselConfig.random === true;
    
    let nextIndex;
    
    if (isRandomMode && carouselState.totalSlides > 1) {
        // 随机播放模式
        // 获取未播放过的幻灯片索引
        const availableSlides = [];
        for (let i = 0; i < carouselState.totalSlides; i++) {
            if (!carouselState.usedSlides.includes(i)) {
                availableSlides.push(i);
            }
        }
        
        // 如果所有幻灯片都已播放过，重置已播放记录并允许随机播放所有图片
        if (availableSlides.length === 0) {
            carouselState.usedSlides = [];
            // 允许随机播放所有幻灯片
            for (let i = 0; i < carouselState.totalSlides; i++) {
                availableSlides.push(i);
            }
        }
        
        // 如果仍有可选幻灯片，从中随机选择
        if (availableSlides.length > 0) {
            const randomIndex = Math.floor(Math.random() * availableSlides.length);
            nextIndex = availableSlides[randomIndex];
        } else {
            // 如果没有可选幻灯片（可能只剩当前幻灯片），选择下一个
            nextIndex = (carouselState.currentSlide + 1) % carouselState.totalSlides;
        }
        
        // 记录已播放的幻灯片
        carouselState.usedSlides.push(nextIndex);
    } else {
        // 顺序播放模式
        nextIndex = (carouselState.currentSlide + 1) % carouselState.totalSlides;
    }
    
    goToSlide(nextIndex);
}

// 跳转到指定幻灯片
function goToSlide(index) {
    if (index === carouselState.currentSlide) return;

    const slides = elements.carouselSlides?.querySelectorAll('.carousel-slide');
    const indicators = elements.carouselIndicators?.querySelectorAll('.carousel-indicator');

    if (slides && slides[carouselState.currentSlide]) {
        slides[carouselState.currentSlide].classList.remove('active');
    }
    if (indicators && indicators[carouselState.currentSlide]) {
        indicators[carouselState.currentSlide].classList.remove('active');
    }

    carouselState.currentSlide = index;

    if (slides && slides[index]) {
        slides[index].classList.add('active');
    }
    if (indicators && indicators[index]) {
        indicators[index].classList.add('active');
    }
}

// 隐藏轮播图
function hideCarousel() {
    // 清除定时器
    if (carouselState.timer) {
        clearInterval(carouselState.timer);
        carouselState.timer = null;
    }
    if (carouselState.progressTimer) {
        cancelAnimationFrame(carouselState.progressTimer);
        carouselState.progressTimer = null;
    }

    // 隐藏容器
    if (elements.carouselContainer) {
        elements.carouselContainer.classList.add('hidden');
        
        // 延迟移除DOM元素，等待动画完成
        setTimeout(() => {
            if (elements.carouselContainer) {
                elements.carouselContainer.style.display = 'none';
            }
        }, 500);
    }
}

// ========== 快捷键功能 ==========

// 注册快捷键监听器
function registerShortcutListeners() {
    if (typeof electronAPI === 'undefined') return;
    
    // 关闭当前应用窗口 (Cmd/Ctrl+W)
    if (electronAPI.onShortcutCloseApp) {
        electronAPI.onShortcutCloseApp(() => {
            if (appStore.activeWindow) {
                closeAppWindow(appStore.activeWindow);
            }
        });
    }
    
    // 切换到下一个应用 (Cmd/Ctrl+Tab)
    if (electronAPI.onShortcutSwitchNext) {
        electronAPI.onShortcutSwitchNext(() => {
            switchToNextApp();
        });
    }
    
    // 切换到上一个应用 (Cmd/Ctrl+Shift+Tab)
    if (electronAPI.onShortcutSwitchPrev) {
        electronAPI.onShortcutSwitchPrev(() => {
            switchToPreviousApp();
        });
    }
    
    // 显示主页 (Cmd/Ctrl+H)
    if (electronAPI.onShortcutShowHome) {
        electronAPI.onShortcutShowHome(() => {
            showLauncherView();
        });
    }
    
    // 最小化当前应用 (Cmd/Ctrl+M)
    if (electronAPI.onShortcutMinimizeApp) {
        electronAPI.onShortcutMinimizeApp(() => {
            if (appStore.activeWindow) {
                minimizeAppWindow(appStore.activeWindow);
            }
        });
    }
}

// 切换到下一个应用
function switchToNextApp() {
    const openAppIds = Array.from(appStore.openWindows.keys());
    if (openAppIds.length === 0) return;
    
    let nextIndex = 0;
    if (appStore.activeWindow) {
        const currentIndex = openAppIds.indexOf(appStore.activeWindow);
        nextIndex = (currentIndex + 1) % openAppIds.length;
    }
    
    const nextAppId = openAppIds[nextIndex];
    activateAppWindow(nextAppId);
}

// 切换到上一个应用
function switchToPreviousApp() {
    const openAppIds = Array.from(appStore.openWindows.keys());
    if (openAppIds.length === 0) return;
    
    let prevIndex = openAppIds.length - 1;
    if (appStore.activeWindow) {
        const currentIndex = openAppIds.indexOf(appStore.activeWindow);
        prevIndex = (currentIndex - 1 + openAppIds.length) % openAppIds.length;
    }
    
    const prevAppId = openAppIds[prevIndex];
    activateAppWindow(prevAppId);
}

// 注册窗口URL变化监听器
function registerWindowUrlChangeListener() {
  if (typeof electronAPI === 'undefined' || !electronAPI.onWindowUrlChanged) return;
  
  electronAPI.onWindowUrlChanged((data) => {
    console.log('窗口URL发生变化:', data);
    // 刷新所有iframe
    refreshAllIframes();
  });
}

// 刷新所有iframe
function refreshAllIframes() {
  const iframes = document.querySelectorAll('iframe');
  iframes.forEach((iframe, index) => {
    try {
      // 检查iframe是否有效
      if (iframe && iframe.contentWindow) {
        // 保存当前iframe的src
        const src = iframe.src;
        // 重新加载iframe
        iframe.src = src;
        console.log(`刷新iframe ${index}:`, src);
      }
    } catch (error) {
      console.error(`刷新iframe ${index} 失败:`, error);
    }
  });
}
function updateDockProgress(data) {
  if (!elements.downloadButton) return;
  let bar = elements.downloadButton.querySelector('.dock-progress');
  if (!bar) {
    bar = document.createElement('div');
    bar.className = 'dock-progress';
    const inner = document.createElement('div');
    inner.className = 'dock-progress-inner';
    bar.appendChild(inner);
    elements.downloadButton.appendChild(bar);
  }
  const innerEl = bar.querySelector('.dock-progress-inner');
  const pct = data.totalBytes > 0 ? Math.floor((data.receivedBytes / data.totalBytes) * 100) : 0;
  if (data.state === 'downloading') {
    bar.style.display = 'block';
    elements.downloadButton.classList.add('with-progress');
    innerEl.style.width = `${pct}%`;
  } else {
    innerEl.style.width = '100%';
    setTimeout(() => {
      bar.style.display = 'none';
      elements.downloadButton.classList.remove('with-progress');
      innerEl.style.width = '0%';
    }, 400);
  }
}
