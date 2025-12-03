const { app, BrowserWindow, ipcMain, dialog, globalShortcut, session, Tray, screen, shell } = require('electron');
const path = require('path');
const si = require('systeminformation');
const configManager = require('./utils/configManager');
const hotkeyBlocker = require('./utils/hotkeyBlocker');
const { getMachineId } = require('./utils/fingerprint');
const { verifyLicense } = require('./utils/license');
const fs = require('fs');
const { spawn, exec } = require('child_process');
const os = require('os');
const koffi = require('koffi');

// 加载原生模块用于按键禁用
let nativeKeyBlocker = null;
try {
  nativeKeyBlocker = require('./native');
  console.log('原生按键禁用模块加载成功');
} catch (err) {
  console.warn('原生按键禁用模块加载失败:', err.message);
}

// 本地应用运行状态管理
const runningLocalApps = new Set();
let kioskEnabled = true;
let localModeActive = false;
let wpsMonitorInterval = null;
let localAppFocusMonitor = null;
let localFocusObserved = false;
let monitorStartTime = 0;
let firstNonElectronObservedPid = 0;
let monitorAppName = '';
let allowedForegroundPids = new Set();

function isWpsLauncherPath(p) {
  if (!p) return false;
  const lower = p.toLowerCase();
  return lower.endsWith('ksolaunch.exe') || lower.includes('kingsoft') || lower.includes('wps office');
}

function isDocLikeFile(p) {
  const ext = (path.extname(p) || '').toLowerCase();
  return ext === '.doc' || ext === '.docx' || ext === '.ppt' || ext === '.pptx' || ext === '.xls' || ext === '.xlsx' || ext === '.pdf';
}

function findWpsExecutable(filePath) {
  if (process.platform !== 'win32') return null;
  const ext = (path.extname(filePath) || '').toLowerCase();
  const pf = process.env['ProgramFiles'] || 'C:\\Program Files';
  const pfx86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
  const localAppData = process.env['LOCALAPPDATA'] || '';
  const bases = [pf, pfx86, localAppData].filter(Boolean);
  let exeNames = ['ksolaunch.exe'];
  if (ext === '.doc' || ext === '.docx' || ext === '.pdf') {
    exeNames = ['ksolaunch.exe', 'wps.exe', 'wpspdf.exe', 'pdf.exe'];
  } else if (ext === '.xls' || ext === '.xlsx') {
    exeNames = ['ksolaunch.exe', 'et.exe'];
  } else if (ext === '.ppt' || ext === '.pptx') {
    exeNames = ['ksolaunch.exe', 'wpp.exe'];
  }
  const subDirs = [
    ['Kingsoft', 'WPS Office'],
    ['Kingsoft', 'WPS Office', 'office6']
  ];
  for (const base of bases) {
    for (const sub of subDirs) {
      for (const name of exeNames) {
        const candidate = path.join(base, ...sub, name);
        try {
          if (fs.existsSync(candidate)) return candidate;
        } catch (_) { }
      }
    }
  }
  return null;
}

function getDocumentEditorPathFromConfig() {
  try {
    const cfg = configManager.getConfig() || {};
    const p = cfg.documentEditorPath;
    if (typeof p === 'string') {
      const trimmed = p.trim();
      if (trimmed) return trimmed;
    }
  } catch (_) { }
  return null;
}

function startWpsMonitor() {
  if (wpsMonitorInterval) return;
  console.log('🔍 启动 WPS 进程监控');
  wpsMonitorInterval = setInterval(async () => {
    try {
      exec('powershell -NoProfile -Command "(Get-Process wps,wpp,et -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 }).Count"', (err, stdout) => {
        if (err) return;
        const count = parseInt(String(stdout).trim(), 10);
        if (!count || count === 0) {
          console.log('⚠️ 所有 WPS 进程已退出');
          clearInterval(wpsMonitorInterval);
          wpsMonitorInterval = null;
          localModeActive = false;
          // 删除虚拟 PID 标记
          runningLocalApps.delete(-1);
          console.log(`📊 当前运行的应用数: ${runningLocalApps.size}`);
          setKioskMode(true);
        }
      });
    } catch (_) { }
  }, 400);
}

function startLocalAppFocusMonitor(appPath) {
  if (process.platform !== 'win32') return;
  try {
    try { monitorAppName = path.parse(appPath || '').name || ''; } catch (_) { monitorAppName = ''; }

    // 检查是否为 WPS 相关应用
    const isWps = isWpsLauncherPath(appPath) || ['wps', 'wpp', 'et', 'ksolaunch'].includes(monitorAppName.toLowerCase());
    console.log(`🔍 启动焦点监控: ${isWps ? 'WPS应用' : monitorAppName}`);

    if (localAppFocusMonitor) {
      clearInterval(localAppFocusMonitor);
      localAppFocusMonitor = null;
    }
    allowedForegroundPids.clear();
    localFocusObserved = false;
    firstNonElectronObservedPid = 0;
    const user32 = koffi.load('user32.dll');
    const GetForegroundWindow = user32.func('GetForegroundWindow', 'intptr', []);
    const GetWindowThreadProcessId = user32.func('GetWindowThreadProcessId', 'uint32', ['intptr', 'uint32*']);

    localAppFocusMonitor = setInterval(() => {
      try {
        // 如果没有本地应用运行，停止监控
        if (runningLocalApps.size === 0) {
          console.log('📌 所有本地应用已退出，停止焦点监控');
          clearInterval(localAppFocusMonitor);
          localAppFocusMonitor = null;
          localFocusObserved = false;
          firstNonElectronObservedPid = 0;
          monitorAppName = '';
          allowedForegroundPids.clear();
          return;
        }

        // 启动后等待1.5秒再开始监控，给应用足够的启动时间
        if (Date.now() - monitorStartTime < 1500) {
          return;
        }

        // 更新允许的前台进程PID列表
        let psCommand = '';
        if (isWps) {
          // 如果是 WPS，同时监控所有相关进程
          psCommand = '(Get-Process wps,wpp,et,ksolaunch -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -ExpandProperty Id) -join " "';
        } else if (monitorAppName) {
          psCommand = '(Get-Process -Name \'' + monitorAppName + '\' -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -ExpandProperty Id) -join " "';
        }

        if (psCommand) {
          exec('powershell -NoProfile -Command "' + psCommand + '"', (err, stdout) => {
            if (err) return;
            const ids = String(stdout).trim().split(/\s+/).map(s => parseInt(s, 10)).filter(n => Number.isFinite(n) && n > 0);
            allowedForegroundPids = new Set(ids);
          });
        }

        // 获取当前前台窗口的进程ID
        const hwnd = GetForegroundWindow();
        if (!hwnd || hwnd === 0) return;
        const pidBuf = Buffer.alloc(4);
        GetWindowThreadProcessId(hwnd, pidBuf);
        const activePid = pidBuf.readUInt32LE(0);
        if (activePid <= 0) return;

        // 状态机逻辑
        if (!localFocusObserved) {
          if (activePid !== process.pid && allowedForegroundPids.size > 0 && allowedForegroundPids.has(activePid)) {
            firstNonElectronObservedPid = activePid;
            localFocusObserved = true;
            console.log(`✅ 本地应用已获得焦点 (PID: ${activePid})`);
          } else if (activePid !== process.pid && allowedForegroundPids.size === 0) {
            const cmd = `(Get-Process -Id ${activePid} -ErrorAction SilentlyContinue | Select-Object -ExpandProperty ProcessName)`;
            exec('powershell -NoProfile -Command "' + cmd + '"', (err, stdout) => {
              if (err) return;
              const pname = String(stdout).trim().toLowerCase();
              const isWpsName = ['wps','wpp','et','ksolaunch'].includes(pname);
              if ((isWps && isWpsName) || (monitorAppName && pname.includes(monitorAppName.toLowerCase()))) {
                firstNonElectronObservedPid = activePid;
                localFocusObserved = true;
                console.log(`✅ 本地应用已获得焦点 (PID: ${activePid})`);
              }
            });
          }
        } else {
          // 监控状态：检测焦点是否离开本地应用
          const isElectronPid = (activePid === process.pid);
          const isAllowedPid = allowedForegroundPids.has(activePid);
          const isFirstObservedPid = (activePid === firstNonElectronObservedPid);

          // 如果当前焦点不是Electron、不是允许的应用，也不是最初观察到的应用
          // 说明焦点已经切换到其他窗口（例如桌面、资源管理器等）
          if (!isElectronPid && !isAllowedPid && !isFirstObservedPid) {
            console.log(`⚠️ 检测到WPS失去焦点，当前焦点PID: ${activePid}`);
            console.log(`📱 恢复Electron窗口并进入Kiosk模式`);
            setKioskMode(true);
          }
        }
      } catch (err) {
        console.error('焦点监控错误:', err.message);
      }
    }, 700);
  } catch (err) {
    console.error('启动焦点监控失败:', err.message);
  }
}

// 切换 Kiosk 模式（锁定/解锁）
function setKioskMode(enable) {
  if (!mainWindow) return;

  if (enable) {
    // 启用锁定模式
    console.log('进入 Kiosk 模式：锁定按键，禁用快捷键');
    kioskEnabled = true;
    localModeActive = false;

    // 恢复原生按键禁用
    if (nativeKeyBlocker) {
      try {
        nativeKeyBlocker.disableAll();
      } catch (err) {
        console.warn('禁用按键失败:', err.message);
      }
    }

    // 注册全局快捷键（禁用 Alt+Tab 等）
    registerGlobalShortcuts();

    // 恢复全屏与 Kiosk
    try {
      mainWindow.setKiosk(true);
      mainWindow.setFullScreen(true);
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
    } catch (_) { }

    // 强制置顶
    mainWindow.setAlwaysOnTop(true, 'screen-saver');
    mainWindow.focus();

  } else {
    // 解除锁定模式
    console.log('退出 Kiosk 模式：允许按键，启用快捷键');
    kioskEnabled = false;
    localModeActive = true;

    // 解除原生按键禁用
    if (nativeKeyBlocker) {
      try {
        nativeKeyBlocker.enableAll();
      } catch (err) {
        console.warn('恢复按键失败:', err.message);
      }
    }

    // 注销全局快捷键（允许 Alt+Tab）
    globalShortcut.unregisterAll();

    // 取消置顶，允许其他窗口覆盖，并退出全屏/kiosk
    try {
      mainWindow.setAlwaysOnTop(false);
      mainWindow.setKiosk(false);
      mainWindow.setFullScreen(false);
      mainWindow.blur();
    } catch (_) { }
    // 这里不强制最小化/隐藏，避免破坏用户切换路径
  }
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
  } catch (_) { }
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
  } catch (_) { }
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

  // 监听窗口焦点变化，处理本地应用共存逻辑
  mainWindow.on('focus', () => {
    // 如果有本地应用在运行，且主窗口获得焦点，说明用户可能最小化了本地应用
    // 此时将主窗口设为置顶，确保覆盖桌面
    if (kioskEnabled && runningLocalApps.size > 0) {
      mainWindow.setAlwaysOnTop(true, 'screen-saver');
      console.log('主窗口获得焦点，临时置顶');
    }
  });

  mainWindow.on('blur', () => {
    // 如果有本地应用在运行，且主窗口失去焦点（用户切换到了本地应用）
    // 取消置顶，防止遮挡本地应用
    if (runningLocalApps.size > 0) {
      mainWindow.setAlwaysOnTop(false);
      console.log('主窗口失去焦点，取消置顶');
    }
  });

  // 防最小化 / 失焦 / 退出等定时检查
  if (!global.windowLockInterval) {
    global.windowLockInterval = setInterval(() => {
      if (!mainWindow) return;

      if (!kioskEnabled || runningLocalApps.size > 0 || localModeActive) {
        return;
      }

      try {
        if (mainWindow.isMinimized()) mainWindow.restore();
        // 移除强制聚焦，允许其他窗口获得焦点
        // if (!mainWindow.isFocused()) { mainWindow.focus(); }
        if (!mainWindow.isFullScreen()) mainWindow.setFullScreen(true);
        // 确保置顶状态
        if (!mainWindow.isAlwaysOnTop()) mainWindow.setAlwaysOnTop(true, 'screen-saver');
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

    // 仅在 Kiosk 模式下进行焦点强制
    if (kioskEnabled && runningLocalApps.size === 0 && !localModeActive) {
      if (!mainWindow.isFocused()) {
        mainWindow.focus();
        console.log(`窗口焦点检查: 第${focusCheckCount}次检查，窗口未获得焦点，已设置焦点`);
      } else {
        console.log(`窗口焦点检查: 第${focusCheckCount}次检查，窗口已获得焦点`);
      }
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

        // 仅在 Kiosk 模式下进行焦点强制
        if (kioskEnabled && runningLocalApps.size === 0 && !localModeActive) {
          if (!mainWindow.isFocused()) {
            mainWindow.focus();
            console.log('窗口焦点检查: 定期检查，窗口未获得焦点，已设置焦点');
          } else {
            console.log('窗口焦点检查: 定期检查，窗口已获得焦点');
          }
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
    // 在 Kiosk 模式且无本地应用运行时，阻止最小化；否则允许最小化
    if (kioskEnabled && runningLocalApps.size === 0) {
      e.preventDefault();
      mainWindow.restore();
      mainWindow.focus();
    }
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
    } catch (_) { }
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
          try { win.close(); } catch (_) { }
        }
      } catch (_) { }
    });
  };
  handleWillDownload(session.defaultSession);
  try {
    const defaultPartition = session.fromPartition('persist:default');
    handleWillDownload(defaultPartition);
  } catch (_) { }
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
    } catch (_) { }
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
    try {
      if (process.platform === 'win32' && isDocLikeFile(info.path)) {
        let exe = null;
        const configured = getDocumentEditorPathFromConfig();
        if (configured && fs.existsSync(configured)) {
          exe = configured;
        } else {
          exe = findWpsExecutable(info.path);
        }
        if (exe && fs.existsSync(exe)) {
          setKioskMode(false);
          try {
            if (mainWindow) {
              mainWindow.setKiosk(false);
              mainWindow.setFullScreen(false);
              mainWindow.setAlwaysOnTop(false);
              mainWindow.blur();
              if (isWpsLauncherPath(exe)) {
                try { mainWindow.minimize(); } catch (_) { }
              }
            }
          } catch (_) { }
          let childProcess;
          try {
            childProcess = spawn(exe, [info.path], { detached: true, stdio: 'ignore' });
          } catch (_) {
            childProcess = null;
          }
          if (childProcess && childProcess.pid) {
            const isWpsApp = isWpsLauncherPath(exe);

            if (isWpsApp) {
              // WPS 启动器会立即退出，不追踪启动器进程
              // 使用一个虚拟标记(-1)表示 WPS 正在运行
              console.log('🚀 启动 WPS 应用，使用虚拟标记');
              runningLocalApps.add(-1);  // 虚拟 PID 标记
              startWpsMonitor();  // 依赖 WPS 监控器来检测进程
              monitorStartTime = Date.now();
              localFocusObserved = false;
              startLocalAppFocusMonitor(exe);

              // 启动器进程的事件我们不关心，因为它会立即退出
              childProcess.unref();  // 不阻止父进程退出
            } else {
              // 非 WPS 应用，正常追踪进程
              const pid = childProcess.pid;
              console.log(`🚀 启动本地应用 (PID: ${pid})`);
              runningLocalApps.add(pid);
              monitorStartTime = Date.now();
              localFocusObserved = false;
              startLocalAppFocusMonitor(exe);

              childProcess.on('close', () => {
                console.log(`📌 应用退出 (PID: ${pid})`);
                runningLocalApps.delete(pid);
                if (runningLocalApps.size === 0) {
                  setKioskMode(true);
                }
              });
              childProcess.on('error', () => {
                runningLocalApps.delete(pid);
                if (runningLocalApps.size === 0) {
                  setKioskMode(true);
                }
                localFocusObserved = false;
              });
            }
            return true;
          }
        }
      }
    } catch (_) { }
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

        // 启动应用前，暂时解除 Kiosk 模式
        // 这样新启动的窗口才能获得焦点，且不被主窗口遮挡
        setKioskMode(false);

        // 退出全屏和 Kiosk，并取消焦点，确保本地应用能显示在最前端
        try {
          if (mainWindow) {
            mainWindow.setKiosk(false);
            mainWindow.setFullScreen(false);
            mainWindow.setAlwaysOnTop(false);
            mainWindow.blur();
            if (isWpsLauncherPath(appPath)) {
              mainWindow.minimize();
            }
          }
        } catch (_) { }

        // 根据不同平台启动应用
        let childProcess;
        const platform = process.platform;

        if (platform === 'win32') {
          // Windows: 使用 spawn 启动 .exe 文件
          childProcess = spawn(appPath, [], { detached: true, stdio: 'ignore' });
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

        const isWpsApp = isWpsLauncherPath(appPath);

        if (isWpsApp) {
          // WPS 启动器会立即退出，不追踪启动器进程
          console.log('🚀 启动 WPS 应用，使用虚拟标记');
          runningLocalApps.add(-1);  // 虚拟 PID 标记
          startWpsMonitor();  // 依赖 WPS 监控器来检测进程
          monitorStartTime = Date.now();
          localFocusObserved = false;
          startLocalAppFocusMonitor(appPath);

          // 启动器进程的事件我们不关心
          childProcess.unref();

          resolve({
            success: true,
            pid: -1  // 虚拟 PID
          });
        } else {
          // 非 WPS 应用，正常追踪进程
          const pid = childProcess.pid;
          runningLocalApps.add(pid);
          console.log(`🚀 启动本地应用 (PID: ${pid})`);
          monitorStartTime = Date.now();
          localFocusObserved = false;
          startLocalAppFocusMonitor(appPath);

          // 监听子进程退出事件
          childProcess.on('close', (code) => {
            console.log(`📌 应用退出 (PID: ${pid})`);
            runningLocalApps.delete(pid);
            if (runningLocalApps.size === 0) {
              setKioskMode(true);
            }
          });

          // 如果子进程启动失败
          childProcess.on('error', (err) => {
            console.error('启动子进程失败:', err);
            runningLocalApps.delete(pid);
            if (runningLocalApps.size === 0) {
              setKioskMode(true);
            }
            localFocusObserved = false;
          });

          resolve({
            success: true,
            pid: pid
          });
        }
      } catch (error) {
        console.error('启动本地应用失败:', error);
        // 发生错误时，尝试恢复 Kiosk 模式
        if (runningLocalApps.size === 0) {
          setKioskMode(true);
        }
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
  try { const s = session.fromPartition('persist:default'); if (s && s.flushStorageData) { s.flushStorageData(); } } catch (_) { }

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
  try { saveDownloadsHistory(); } catch (_) { }
});
