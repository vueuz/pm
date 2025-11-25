const { app, BrowserWindow, ipcMain, dialog, globalShortcut, session, Tray, screen, shell } = require('electron');
const path = require('path');
const si = require('systeminformation');
const configManager = require('./utils/configManager');
const hotkeyBlocker = require('./utils/hotkeyBlocker');
const { getMachineId } = require('./utils/fingerprint');
const { verifyLicense } = require('./utils/license');
const fs = require('fs');
const { spawn } = require('child_process');
const os = require('os');

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
let activationWindow = null;
let tray = null;
let downloadsWindow = null;
 

const downloadsStore = {
  current: new Map(),
  history: []
};

const MAX_DOWNLOAD_HISTORY = 200;

function loadDownloadsHistory() {
  try {
    const dir = path.join(app.getPath('userData'), 'downloads');
    const file = path.join(dir, 'history.json');
    if (fs.existsSync(file)) {
      const data = fs.readFileSync(file, 'utf8');
      const arr = JSON.parse(data);
      if (Array.isArray(arr)) {
        downloadsStore.history = arr.slice(0, MAX_DOWNLOAD_HISTORY);
      }
    }
  } catch (_) {}
}

function saveDownloadsHistory() {
  try {
    const dir = path.join(app.getPath('userData'), 'downloads');
    const file = path.join(dir, 'history.json');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (downloadsStore.history.length > MAX_DOWNLOAD_HISTORY) {
      downloadsStore.history = downloadsStore.history.slice(0, MAX_DOWNLOAD_HISTORY);
    }
    fs.writeFileSync(file, JSON.stringify(downloadsStore.history, null, 2));
  } catch (_) {}
}

// 许可证存储路径
const licenseFile = path.join(app.getPath('userData'), 'license.dat');

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
    // 添加图标配置
    icon: path.join(__dirname, 'assets/icons/app-icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false, // 仅用于开发环境，允许加载远程内容
      webviewTag: true,
      session: session.fromPartition('persist:default')
    }
  });

  // 加载主界面
  mainWindow.loadFile('renderer/index.html');

  // 窗口锁定强化
  mainWindow.setFullScreen(true);
  mainWindow.setFocusable(true);
  mainWindow.setSkipTaskbar(true);
  // 设置窗口置顶
  mainWindow.setAlwaysOnTop(true, 'screen-saver');

  // 防最小化 / 失焦 / 退出等定时检查
  if (!global.windowLockInterval) {
    global.windowLockInterval = setInterval(() => {
      if (!mainWindow) return;
      try {
        if (mainWindow.isMinimized()) mainWindow.restore();
        // 移除强制聚焦，允许其他窗口获得焦点
        // if (!mainWindow.isFocused()) { mainWindow.focus(); }
        if (!mainWindow.isFullScreen()) mainWindow.setFullScreen(true);
      } catch (e) {
        // 忽略错误
      }
    }, 1000);
  }

  // 启动后前3秒内多次检查窗口焦点状态，之后改为每秒检查
  let focusCheckCount = 0;
  let isInitialPhase = true;
  const initialInterval = setInterval(() => {
    if (!mainWindow) return;
    
    focusCheckCount++;
    
    // 检查窗口是否获得焦点，如果没有则使其获得焦点
    if (!mainWindow.isFocused()) {
      mainWindow.focus();
      console.log(`窗口焦点检查: 第${focusCheckCount}次检查，窗口未获得焦点，已设置焦点`);
    } else {
      console.log(`窗口焦点检查: 第${focusCheckCount}次检查，窗口已获得焦点`);
    }
    
    // 3秒后（6次检查）切换到每秒检查模式
    if (focusCheckCount >= 6) {
      clearInterval(initialInterval);
      isInitialPhase = false;
      console.log('窗口焦点检查: 3秒内密集检查已完成，切换到每秒检查模式');
      
      // 启动每秒检查的定时器
      const regularInterval = setInterval(() => {
        if (!mainWindow) {
          clearInterval(regularInterval);
          return;
        }
        
        // 检查窗口是否获得焦点，如果没有则使其获得焦点
        if (!mainWindow.isFocused()) {
          mainWindow.focus();
          console.log('窗口焦点检查: 定期检查，窗口未获得焦点，已设置焦点');
        } else {
          console.log('窗口焦点检查: 定期检查，窗口已获得焦点');
        }
      }, 1000);
    }
  }, 500);

  // 开发模式下打开开发者工具
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  // 窗口聚焦时禁用按键
  // mainWindow.on('focus', () => {
  //   if (nativeKeyBlocker) {
  //     try {
  //       nativeKeyBlocker.disableAll();
  //       console.log('窗口聚焦，禁用按键');
  //     } catch (err) {
  //       console.error('禁用按键失败:', err.message);
  //     }
  //   }
  // });
  
  // 应用启动时就禁用按键
  if (nativeKeyBlocker) {
    try {
      nativeKeyBlocker.disableAll();
      console.log('应用启动，禁用按键');
    } catch (err) {
      console.error('禁用按键失败:', err.message);
    }
  }

  // // 窗口失焦时恢复按键
  // mainWindow.on('blur', () => {
  //   if (nativeKeyBlocker) {
  //     try {
  //       nativeKeyBlocker.enableAll();
  //       console.log('窗口失焦，恢复按键');
  //     } catch (err) {
  //       console.error('恢复按键失败:', err.message);
  //     }
  //   }
  // });

  // 监听窗口关闭事件
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
  
  mainWindow.on('minimize', (e) => {
    e.preventDefault();
    mainWindow.restore();
    mainWindow.focus();
  });
  
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    return {
      action: 'allow',
      overrideBrowserWindowOptions: {
        show: false,
        frame: false,
        skipTaskbar: true,
        autoHideMenuBar: true,
        transparent: true,
        width: 1,
        height: 1
      }
    };
  });

  mainWindow.webContents.on('did-create-window', (child) => {
    try {
      child.hide();
      child.setSkipTaskbar(true);
      child.webContents.setWindowOpenHandler(() => ({
        action: 'allow',
        overrideBrowserWindowOptions: {
          show: false,
          frame: false,
          skipTaskbar: true,
          autoHideMenuBar: true,
          transparent: true,
          width: 1,
          height: 1
        }
      }));
    } catch (_) {}
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
  
  // 监听导航事件，当URL发生变化时通知渲染进程刷新iframe
  mainWindow.webContents.on('did-navigate', (event, url, httpResponseCode, httpStatusText) => {
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.send('window-url-changed', { url, httpResponseCode, httpStatusText });
    }
  });
  
  // 监听导航完成事件
  mainWindow.webContents.on('did-navigate-in-page', (event, url, isMainFrame) => {
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.send('window-url-changed', { url, isMainFrame });
    }
  });
  
  // 配置持久化会话，确保iframe中的cookie能够正确存储
  const webContainerSession = session.fromPartition('persist:webcontainer');
  webContainerSession.setUserAgent(mainWindow.webContents.getUserAgent());
  
  // 启用cookies
  webContainerSession.cookies.on('changed', (event, cookie, cause, removed) => {
    console.log('Cookie发生变化:', cookie.name, cookie.domain, cause, removed ? '已删除' : '已添加/修改');
  });
  
  // 设置网络请求头，确保cookie能正确发送
  webContainerSession.webRequest.onBeforeSendHeaders((details, callback) => {
    // 确保cookie头被正确设置
    callback({ requestHeaders: details.requestHeaders });
  });
  
  // 设置cookie策略，允许所有cookie
  webContainerSession.setPermissionRequestHandler((webContents, permission, callback) => {
    if (permission === 'cookies') {
      callback(true); // 允许cookie
    } else {
      callback(false); // 拒绝其他权限
    }
  });
  
  // 禁用拼写检查以减少干扰
  webContainerSession.setSpellCheckerEnabled(false);
}

function registerDownloadListener() {
  const handleWillDownload = (sess) => {
    if (!sess || !sess.on) return;
    sess.on('will-download', (event, item, webContents) => {
      const filename = item.getFilename();
      const downloadsPath = app.getPath('downloads');
      let savePath = path.join(downloadsPath, filename);
      let counter = 1;
      const { name, ext } = path.parse(filename);

      while (fs.existsSync(savePath)) {
        const newFilename = `${name} (${counter})${ext}`;
        savePath = path.join(downloadsPath, newFilename);
        counter++;
      }

      item.setSavePath(savePath);
      const finalFilename = path.basename(savePath);

      const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const info = {
        id,
        filename: finalFilename,
        path: savePath,
        receivedBytes: 0,
        totalBytes: item.getTotalBytes(),
        state: 'downloading',
        speed: 0
      };
      downloadsStore.current.set(id, info);
      if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send('download-start', info);
      }
      
      let lastBytes = 0;
      let lastTime = Date.now();
      item.on('updated', () => {
        const received = item.getReceivedBytes();
        const total = item.getTotalBytes();
        const now = Date.now();
        const deltaBytes = received - lastBytes;
        const deltaTime = now - lastTime;
        const speed = deltaTime > 0 ? Math.round(deltaBytes / (deltaTime / 1000)) : 0;
        lastBytes = received;
        lastTime = now;
        const current = downloadsStore.current.get(id);
        if (!current) return;
        current.receivedBytes = received;
        current.totalBytes = total;
        current.state = 'downloading';
        current.speed = speed;
        downloadsStore.current.set(id, current);
        if (mainWindow && mainWindow.webContents) {
          mainWindow.webContents.send('download-progress', current);
        }
      });
      item.once('done', (eventDone, state) => {
        const current = downloadsStore.current.get(id);
        if (!current) return;
        current.state = state === 'completed' ? 'completed' : 'cancelled';
        downloadsStore.current.set(id, current);
        downloadsStore.history.unshift(current);
        saveDownloadsHistory();
        if (mainWindow && mainWindow.webContents) {
          if (state === 'completed') {
            mainWindow.webContents.send('download-complete', current);
          } else {
            mainWindow.webContents.send('download-cancelled', current);
          }
        }
        
      });
      try {
        const win = BrowserWindow.fromWebContents(webContents);
        if (win && win !== mainWindow && win !== settingsWindow && win !== activationWindow && win !== downloadsWindow) {
          try { win.close(); } catch (_) {}
        }
      } catch (_) {}
    });
  };
  handleWillDownload(session.defaultSession);
  try {
    const defaultPartition = session.fromPartition('persist:default');
    handleWillDownload(defaultPartition);
  } catch (_) {}
}

function createTray() {
  const iconPath = process.platform === 'linux' ? path.join(__dirname, 'assets/icons/app-icon-linux.png') : path.join(__dirname, 'assets/icons/app-icon.ico');
  tray = new Tray(iconPath);
  tray.setToolTip('下载管理器');
  tray.on('click', () => {
    toggleDownloadsWindow();
  });
}

function calculatePopupPosition(targetBounds, winWidth, winHeight) {
  const display = screen.getPrimaryDisplay();
  const workArea = display.workArea;
  let x = Math.round(targetBounds.x + targetBounds.width / 2 - winWidth / 2);
  let y;
  if (process.platform === 'darwin') {
    y = Math.round(targetBounds.y + targetBounds.height + 6);
  } else {
    y = Math.round(targetBounds.y - winHeight - 6);
  }
  if (x < workArea.x) x = workArea.x + 6;
  if (x + winWidth > workArea.x + workArea.width) x = workArea.x + workArea.width - winWidth - 6;
  if (y < workArea.y) y = workArea.y + 6;
  if (y + winHeight > workArea.y + workArea.height) y = workArea.y + workArea.height - winHeight - 6;
  return { x, y };
}

function createDownloadsWindow() {
  if (downloadsWindow) return;
  downloadsWindow = new BrowserWindow({
    width: 420,
    height: 520,
    resizable: false,
    frame: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    transparent: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });
  downloadsWindow.loadFile('renderer/downloads/index.html');
  downloadsWindow.on('blur', () => {
    if (downloadsWindow) downloadsWindow.hide();
  });
  downloadsWindow.on('closed', () => {
    downloadsWindow = null;
  });
}

function toggleDownloadsWindow() {
  if (!tray) return;
  if (!downloadsWindow) createDownloadsWindow();
  const bounds = tray.getBounds();
  const size = downloadsWindow.getBounds();
  const pos = calculatePopupPosition(bounds, size.width, size.height);
  downloadsWindow.setPosition(pos.x, pos.y, true);
  if (downloadsWindow.isVisible()) {
    downloadsWindow.hide();
  } else {
    downloadsWindow.show();
    if (downloadsWindow && downloadsWindow.webContents) {
      const list = Array.from(downloadsStore.current.values());
      const history = downloadsStore.history;
      downloadsWindow.webContents.send('download-list', { list, history });
    }
  }
}

 

 

// 创建激活窗口
function createActivationWindow() {
  if (activationWindow) {
    activationWindow.focus();
    return;
  }

  activationWindow = new BrowserWindow({
    width: 650,
    height: 700,
    minWidth: 600,
    minHeight: 650,
    resizable: false,
    // 添加图标配置
    icon: path.join(__dirname, 'assets/icons/app-icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    },
    title: '软件激活',
    modal: true,
    center: true
  });

  activationWindow.loadFile('renderer/activation/index.html');

  // 开发模式下打开开发者工具
  if (process.env.NODE_ENV === 'development') {
    activationWindow.webContents.openDevTools();
  }

  activationWindow.on('closed', () => {
    activationWindow = null;
  });
}

// 检查许可证
async function checkLicenseOnStartup() {
  try {
    const machineId = await getMachineId();
    
    // 检查许可证文件是否存在
    if (!fs.existsSync(licenseFile)) {
      console.log('许可证文件不存在，需要激活');
      return false;
    }
    
    // 读取许可证
    const license = fs.readFileSync(licenseFile, 'utf8').trim();
    
    // 验证许可证
    const result = verifyLicense(machineId, license);
    
    if (result.valid) {
      console.log('许可证验证成功:', result.message);
      console.log('过期日期:', result.expiryDate);
      console.log('剩余天数:', result.remainingDays);
      
      // 如果剩余天数少于30天，显示警告
      if (result.remainingDays < 30) {
        setTimeout(() => {
          if (mainWindow) {
            dialog.showMessageBox(mainWindow, {
              type: 'warning',
              title: '许可证即将过期',
              message: `您的许可证将在 ${result.remainingDays} 天后过期`,
              detail: `过期日期: ${result.expiryDate}\n\n请及时联系供应商续期。`,
              buttons: ['我知道了']
            });
          }
        }, 3000);
      }
      
      return true;
    } else {
      console.log('许可证验证失败:', result.message);
      return false;
    }
  } catch (error) {
    console.error('许可证检查失败:', error);
    // 添加更详细的错误信息
    console.error('错误详情:', error.stack);
    return false;
  }
}

// 保存许可证
function saveLicense(license) {
  try {
    const dir = path.dirname(licenseFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(licenseFile, license, 'utf8');
    return true;
  } catch (error) {
    console.error('保存许可证失败:', error);
    return false;
  }
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
    // 添加图标配置
    icon: path.join(__dirname, 'assets/icons/app-icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // 加载设置界面
  settingsWindow.loadFile('renderer/settings/index.html');
  
  // 开发模式下打开开发者工具
  if (process.env.NODE_ENV === 'development') {
    settingsWindow.webContents.openDevTools();
  }
  
  // 设置窗口创建后继续保持按键禁用
  settingsWindow.on('ready-to-show', () => {
    if (nativeKeyBlocker) {
      try {
        nativeKeyBlocker.disableAll();
        console.log('🔒 设置窗口创建，继续保持按键禁用');
      } catch (err) {
        console.error('❌ 禁用按键失败:', err.message);
      }
    }
  });

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
app.whenReady().then(async () => {
  try {
    // 检查许可证
    const isLicenseValid = await checkLicenseOnStartup();
    
    if (!isLicenseValid) {
      // 许可证无效，显示激活窗口
      createActivationWindow();
    } else {
      // 许可证有效，创建主窗口
      createMainWindow();
    }
  } catch (error) {
    console.error('启动时检查许可证失败:', error);
    // 即使许可证检查失败，也尝试创建主窗口
    createMainWindow();
  }

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

  loadDownloadsHistory();

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
  registerDownloadListener();
});

// 注册IPC处理程序
function registerIPCHandlers() {
  // 处理系统信息请求
  ipcMain.handle('get-system-info', async () => {
    return await getSystemInfo();
  });
  
  // 获取系统用户名
  ipcMain.handle('get-username', async () => {
    try {
      return os.userInfo().username;
    } catch (error) {
      console.error('获取用户名失败:', error);
      // 如果无法获取用户名，返回默认值
      return '用户';
    }
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
    const ok = configManager.saveConfig(config);
    try {
      if (ok && mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send('config-updated', configManager.getConfig());
      }
    } catch (_) {}
    return ok;
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

  ipcMain.on('downloads-window-ready', () => {
    if (mainWindow && mainWindow.webContents) {
      const list = Array.from(downloadsStore.current.values());
      const history = downloadsStore.history;
      mainWindow.webContents.send('download-list', { list, history });
    }
  });

  ipcMain.handle('download-open-file', (event, id) => {
    const info = downloadsStore.current.get(id) || downloadsStore.history.find(i => i.id === id);
    if (!info) return false;
    shell.openPath(info.path);
    return true;
  });

  ipcMain.handle('download-open-folder', (event, id) => {
    const info = downloadsStore.current.get(id) || downloadsStore.history.find(i => i.id === id);
    if (!info) return false;
    shell.showItemInFolder(info.path);
    return true;
  });

  

  // 许可证管理相关IPC处理
  ipcMain.handle('get-machine-id', async () => {
    try {
      return await getMachineId();
    } catch (error) {
      throw new Error('获取机器指纹失败: ' + error.message);
    }
  });

  ipcMain.handle('activate-license', async (event, license) => {
    try {
      const machineId = await getMachineId();
      const result = verifyLicense(machineId, license);
      
      if (result.valid) {
        // 保存许可证
        if (saveLicense(license)) {
          // 关闭激活窗口，创建主窗口
          if (activationWindow) {
            activationWindow.close();
          }
          if (!mainWindow) {
            createMainWindow();
          }
          return {
            success: true,
            status: result
          };
        } else {
          return {
            success: false,
            message: '保存许可证失败'
          };
        }
      } else {
        return {
          success: false,
          message: result.message
        };
      }
    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    }
  });

  ipcMain.handle('check-license', async () => {
    try {
      const machineId = await getMachineId();
      
      if (!fs.existsSync(licenseFile)) {
        return {
          valid: false,
          message: '未激活'
        };
      }
      
      const license = fs.readFileSync(licenseFile, 'utf8').trim();
      return verifyLicense(machineId, license);
    } catch (error) {
      return {
        valid: false,
        message: '检查失败: ' + error.message
      };
    }
  });

  ipcMain.on('close-activation-window', () => {
    if (activationWindow) {
      activationWindow.close();
    }
  });
  
  // 启动本地应用
  ipcMain.handle('launch-local-app', (event, appPath) => {
    return new Promise((resolve) => {
      try {
        // 检查文件是否存在
        if (!fs.existsSync(appPath)) {
          resolve({
            success: false,
            error: '应用文件不存在'
          });
          return;
        }
        
        // 根据不同平台启动应用
        let childProcess;
        const platform = process.platform;
        
        if (platform === 'win32') {
          // Windows: 使用 spawn 启动 .exe 文件
          childProcess = spawn(appPath, [], { 
            detached: true, 
            stdio: 'ignore' 
          });
        } else if (platform === 'darwin') {
          // macOS: 使用 open 命令启动 .app 文件
          childProcess = spawn('open', [appPath], { 
            detached: true, 
            stdio: 'ignore' 
          });
        } else {
          // Linux: 直接执行文件
          childProcess = spawn(appPath, [], { 
            detached: true, 
            stdio: 'ignore' 
          });
        }
        
        // 不等待子进程退出，直接返回成功
        childProcess.unref();
        
        resolve({
          success: true,
          pid: childProcess.pid
        });
      } catch (error) {
        console.error('启动本地应用失败:', error);
        resolve({
          success: false,
          error: error.message
        });
      }
    });
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
  try { const s = session.fromPartition('persist:default'); if (s && s.flushStorageData) { s.flushStorageData(); } } catch (_) {}
  
  // 停止热键拦截
  try { 
    if (hotkeyBlocker && hotkeyBlocker.stop) {
      hotkeyBlocker.stop(); 
    }
  } catch (e) {
    console.warn('停止热键拦截时出错:', e.message);
  }
  
  // 清除窗口锁定定时器
  if (global.windowLockInterval) {
    clearInterval(global.windowLockInterval);
    global.windowLockInterval = null;
  }
  try { saveDownloadsHistory(); } catch (_) {}
});
