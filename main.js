const { app, BrowserWindow, ipcMain, dialog, globalShortcut } = require('electron');
const path = require('path');
const si = require('systeminformation');
const configManager = require('./utils/configManager');
const hotkeyBlocker = require('./utils/hotkeyBlocker');

// 加载原生模块用于按键禁用
let nativeKeyBlocker = null;
try {
  nativeKeyBlocker = require('./native');
  console.log('原生按键禁用模块加载成功');
} catch (err) {
  console.warn('原生按键禁用模块加载失败:', err.message);
}

// 主窗口引用
let mainWindow = null;
let settingsWindow = null;

// 创建主窗口
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    frame: false,
    kiosk: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    autoHideMenuBar: true,
    fullscreen: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false // 仅用于开发环境，允许加载远程内容
    }
  });

  // 加载主界面
  mainWindow.loadFile('renderer/index.html');

  // 窗口锁定强化
  mainWindow.setAlwaysOnTop(true, 'screen-saver');
  mainWindow.setFullScreen(true);
  mainWindow.setFocusable(true);
  mainWindow.setSkipTaskbar(true);

  // 防最小化 / 失焦 / 退出等定时检查
  if (!global.windowLockInterval) {
    global.windowLockInterval = setInterval(() => {
      if (!mainWindow) return;
      try {
        if (mainWindow.isMinimized()) mainWindow.restore();
        if (!mainWindow.isFocused()) { mainWindow.focus(); }
        if (!mainWindow.isFullScreen()) mainWindow.setFullScreen(true);
        mainWindow.setAlwaysOnTop(true, 'screen-saver');
      } catch (e) {
        // 忽略错误
      }
    }, 1000);
  }

  // 开发模式下打开开发者工具
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  // 窗口聚焦时禁用按键
  mainWindow.on('focus', () => {
    if (nativeKeyBlocker) {
      try {
        nativeKeyBlocker.disableAll();
        console.log('窗口聚焦，禁用按键');
      } catch (err) {
        console.error('禁用按键失败:', err.message);
      }
    }
  });

  // 窗口失焦时恢复按键
  mainWindow.on('blur', () => {
    if (nativeKeyBlocker) {
      try {
        nativeKeyBlocker.enableAll();
        console.log('窗口失焦，恢复按键');
      } catch (err) {
        console.error('恢复按键失败:', err.message);
      }
    }
  });

  // 监听窗口关闭事件
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
  
  mainWindow.on('minimize', (e) => {
    e.preventDefault();
    mainWindow.restore();
    mainWindow.focus();
  });
  
  // 处理新窗口打开事件，避免ERR_BLOCKED_BY_RESPONSE错误
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    return { action: 'allow' };
  });
  
  // 处理导航事件
  mainWindow.webContents.session.webRequest.onBeforeRequest((details, callback) => {
    callback({ cancel: false });
  });
  
  // 处理响应头
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    const headers = details.responseHeaders || {};
    callback({ responseHeaders: headers });
  });
}

// 创建设置窗口
function createSettingsWindow() {
  if (settingsWindow) {
    settingsWindow.focus();
    return;
  }

  settingsWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // 加载设置界面
  settingsWindow.loadFile('renderer/settings/index.html');

  // 监听窗口关闭事件
  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });
}

// 获取系统信息
async function getSystemInfo() {
  try {
    const cpu = await si.cpuCurrentSpeed();
    const mem = await si.mem();
    const cpuLoad = await si.currentLoad();
    
    return {
      cpuUsage: Math.round(cpuLoad.currentLoad),
      memoryUsage: Math.round((mem.used / mem.total) * 100),
      // GPU 信息可能需要额外处理
      gpuUsage: 0,
      timestamp: new Date().toLocaleTimeString()
    };
  } catch (error) {
    console.error('Error getting system info:', error);
    return {
      cpuUsage: 0,
      memoryUsage: 0,
      gpuUsage: 0,
      timestamp: new Date().toLocaleTimeString()
    };
  }
}

// 应用准备就绪时创建窗口
app.whenReady().then(() => {
  createMainWindow();

  // 启动 Windows 热键拦截（仅在 win32）
  try {
    const started = require('os').platform() === 'win32' ? hotkeyBlocker.start() : false;
    if (started) console.log('Windows 热键拦截已启用');
  } catch (e) {
    console.warn('热键拦截启动失败:', e && e.message);
  }

  // 注册IPC处理程序
  registerIPCHandlers();

  // 注册全局快捷键
  registerGlobalShortcuts();

  // macOS 特殊处理：如果没有窗口则创建新窗口
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
  
  // 添加会话权限处理
  app.on('session-created', (session) => {
    session.setPermissionRequestHandler((webContents, permission, callback) => {
      callback(true);
    });
  });
});

// 注册IPC处理程序
function registerIPCHandlers() {
  // 处理系统信息请求
  ipcMain.handle('get-system-info', async () => {
    return await getSystemInfo();
  });

  // 处理退出应用请求
  ipcMain.on('quit-app', () => {
    app.quit();
  });

  // 配置管理相关IPC处理
  ipcMain.handle('get-config', () => {
    return configManager.getConfig();
  });

  ipcMain.handle('save-config', (event, config) => {
    return configManager.saveConfig(config);
  });

  ipcMain.handle('reset-config', () => {
    return configManager.resetToDefault();
  });

  ipcMain.handle('export-config', async (event) => {
    const result = await dialog.showSaveDialog({
      title: '导出配置文件',
      defaultPath: 'config.json',
      filters: [
        { name: 'JSON Files', extensions: ['json'] }
      ]
    });

    if (!result.canceled && result.filePath) {
      return configManager.exportConfig(result.filePath);
    }
    return false;
  });

  ipcMain.handle('import-config', async (event, filePath) => {
    try {
      const result = await dialog.showOpenDialog({
        title: '导入配置文件',
        filters: [
          { name: 'JSON Files', extensions: ['json'] }
        ],
        properties: ['openFile']
      });

      if (!result.canceled && result.filePaths.length > 0) {
        const importedConfig = configManager.importConfig(result.filePaths[0]);
        return importedConfig;
      }
      return null;
    } catch (error) {
      throw error;
    }
  });

  ipcMain.handle('open-settings-window', () => {
    createSettingsWindow();
  });
}

// 注册全局快捷键
function registerGlobalShortcuts() {
  // 注册 Alt+Tab 快捷键（Windows/Linux）
  const retAlt = globalShortcut.register('Alt+Tab', () => {
    dialog.showMessageBox(mainWindow, {
      type: 'warning',
      title: '操作限制',
      message: '不允许退出',
      detail: '此操作已被禁用，您无法通过 Alt+Tab 退出应用。',
      buttons: ['确定']
    });
  });

  // 注册 Command+Tab 快捷键（macOS）
  const retCmd = globalShortcut.register('Command+Tab', () => {
    dialog.showMessageBox(mainWindow, {
      type: 'warning',
      title: '操作限制',
      message: '不允许退出',
      detail: '此操作已被禁用，您无法通过 Command+Tab 退出应用。',
      buttons: ['确定']
    });
  });

  if (!retAlt) {
    console.log('Alt+Tab 快捷键注册失败');
  }
  if (!retCmd) {
    console.log('Command+Tab 快捷键注册失败');
  }

  // 检查快捷键是否注册成功
  console.log('Alt+Tab 快捷键已注册:', globalShortcut.isRegistered('Alt+Tab'));
  console.log('Command+Tab 快捷键已注册:', globalShortcut.isRegistered('Command+Tab'));
}

// 所有窗口关闭时的行为
app.on('window-all-closed', () => {
  // macOS 以外的平台退出应用
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// 应用退出前注销所有快捷键并恢复按键
app.on('will-quit', () => {
  console.log('应用即将退出，恢复所有按键');
  
  // 恢复原生模块禁用的按键
  if (nativeKeyBlocker) {
    try {
      nativeKeyBlocker.enableAll();
      console.log('原生按键已恢复');
    } catch (err) {
      console.error('恢复按键失败:', err.message);
    }
  }
  
  // 注销全局快捷键
  globalShortcut.unregisterAll();
  
  // 停止热键拦截
  try { 
    hotkeyBlocker.stop && hotkeyBlocker.stop(); 
  } catch {}
});