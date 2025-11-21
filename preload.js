const { contextBridge, ipcRenderer } = require('electron');

// 安全地暴露 API 给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  // 获取系统信息
  getSystemInfo: () => ipcRenderer.invoke('get-system-info'),
  
  // 获取系统用户名
  getUsername: () => ipcRenderer.invoke('get-username'),
  
  // 退出应用
  quitApp: () => ipcRenderer.send('quit-app'),
  
  // 监听系统信息更新
  onSystemInfoUpdate: (callback) => {
    const subscription = (event, data) => callback(data);
    ipcRenderer.on('system-info-update', subscription);
    return () => ipcRenderer.removeListener('system-info-update', subscription);
  },

  // 配置管理
  getConfig: () => ipcRenderer.invoke('get-config'),
  saveConfig: (config) => ipcRenderer.invoke('save-config', config),
  resetConfig: () => ipcRenderer.invoke('reset-config'),
  exportConfig: () => ipcRenderer.invoke('export-config'),
  importConfig: (filePath) => ipcRenderer.invoke('import-config', filePath),
  openSettingsWindow: () => ipcRenderer.invoke('open-settings-window'),
  getConfigPath: () => ipcRenderer.invoke('get-config-path'),
  
  // 监听配置更新
  onConfigUpdate: (callback) => {
    const subscription = (event, config) => callback(config);
    ipcRenderer.on('config-updated', subscription);
    return () => ipcRenderer.removeListener('config-updated', subscription);
  },
  
  // 监听窗口URL变化事件
  onWindowUrlChanged: (callback) => {
    const subscription = (event, data) => callback(data);
    ipcRenderer.on('window-url-changed', subscription);
    return () => ipcRenderer.removeListener('window-url-changed', subscription);
  },
  
  // 快捷键事件监听
  onShortcutCloseApp: (callback) => {
    const subscription = (event) => callback();
    ipcRenderer.on('shortcut-close-app', subscription);
    return () => ipcRenderer.removeListener('shortcut-close-app', subscription);
  },
  onShortcutSwitchNext: (callback) => {
    const subscription = (event) => callback();
    ipcRenderer.on('shortcut-switch-next', subscription);
    return () => ipcRenderer.removeListener('shortcut-switch-next', subscription);
  },
  onShortcutSwitchPrev: (callback) => {
    const subscription = (event) => callback();
    ipcRenderer.on('shortcut-switch-prev', subscription);
    return () => ipcRenderer.removeListener('shortcut-switch-prev', subscription);
  },
  onShortcutShowHome: (callback) => {
    const subscription = (event) => callback();
    ipcRenderer.on('shortcut-show-home', subscription);
    return () => ipcRenderer.removeListener('shortcut-show-home', subscription);
  },
  onShortcutMinimizeApp: (callback) => {
    const subscription = (event) => callback();
    ipcRenderer.on('shortcut-minimize-app', subscription);
    return () => ipcRenderer.removeListener('shortcut-minimize-app', subscription);
  },
  
  // 启动本地应用
  launchLocalApp: (appPath) => ipcRenderer.invoke('launch-local-app', appPath),
  
  // 许可证管理
  getMachineId: () => ipcRenderer.invoke('get-machine-id'),
  activateLicense: (license) => ipcRenderer.invoke('activate-license', license),
  checkLicense: () => ipcRenderer.invoke('check-license'),
  closeActivationWindow: () => ipcRenderer.send('close-activation-window')
});