/**
 * 安全管理器 - 统一管理窗口锁定和热键拦截功能
 */

const hotkeyBlocker = require('./hotkeyBlocker');
const path = require('path');
const { app } = require('electron');

// 加载原生模块用于按键禁用
let nativeKeyBlocker = null;
try {
  const isDev = !app.isPackaged;
  console.log('🔍 环境检测:');
  console.log('   - 开发模式:', isDev);
  console.log('   - 资源路径:', process.resourcesPath);
  console.log('   - 应用路径:', app.getAppPath());
  
  nativeKeyBlocker = require('../native');
  console.log('✅ 原生按键禁用模块加载成功');
} catch (err) {
  console.warn('⚠️  原生按键禁用模块加载失败:', err.message);
  console.warn('   完整错误:', err.stack);
  // 即使原生模块加载失败，也要确保应用可以正常运行
  nativeKeyBlocker = {
    enableAll: () => {
      console.warn('原生模块不可用，enableAll 是空操作');
      return true;
    },
    disableAll: () => {
      console.warn('原生模块不可用，disableAll 是空操作');
      return true;
    }
  };
}

class SecurityManager {
  constructor() {
    this.mainWindow = null;
    this.lockInterval = null;
    this.isInitialized = false;
  }

  /**
   * 初始化安全管理器
   * @param {BrowserWindow} window - 主窗口实例
   */
  initialize(window) {
    if (this.isInitialized) {
      console.warn('⚠️  安全管理器已初始化');
      return;
    }

    this.mainWindow = window;
    
    // 设置窗口锁定
    this._setupWindowLock();
    
    // 设置热键拦截
    this._setupHotkeyBlocker();
    
    // 设置原生按键禁用
    this._setupNativeKeyBlocker();
    
    this.isInitialized = true;
    console.log('✅ 安全管理器初始化完成');
  }

  /**
   * 设置窗口锁定
   */
  _setupWindowLock() {
    if (!this.mainWindow) return;

    // 窗口锁定强化
    this.mainWindow.setAlwaysOnTop(true, 'screen-saver');
    this.mainWindow.setFullScreen(true);
    this.mainWindow.setFocusable(true);
    this.mainWindow.setSkipTaskbar(true);

    // 防最小化 / 失焦 / 退出等定时检查
    this.lockInterval = setInterval(() => {
      if (!this.mainWindow) return;
      try {
        if (this.mainWindow.isMinimized()) this.mainWindow.restore();
        if (!this.mainWindow.isFocused()) this.mainWindow.focus();
        if (!this.mainWindow.isFullScreen()) this.mainWindow.setFullScreen(true);
        this.mainWindow.setAlwaysOnTop(true, 'screen-saver');
      } catch (e) {
        // 忽略错误
      }
    }, 1000);

    console.log('✅ 窗口锁定已启用');
  }

  /**
   * 设置热键拦截（Windows平台）
   */
  _setupHotkeyBlocker() {
    try {
      if (require('os').platform() === 'win32' && hotkeyBlocker.start) {
        const started = hotkeyBlocker.start();
        if (started) {
          console.log('✅ Windows 热键拦截已启用');
        }
      }
    } catch (e) {
      console.warn('⚠️  热键拦截启动失败:', e && e.message);
    }
  }

  /**
   * 设置原生按键禁用
   */
  _setupNativeKeyBlocker() {
    if (!nativeKeyBlocker) return;

    // 应用启动时就禁用按键
    try {
      const result = nativeKeyBlocker.disableAll();
      console.log('🔒 应用启动，禁用系统按键，结果:', result);
    } catch (err) {
      console.error('❌ 禁用按键失败:', err.message);
    }

    // 如果有主窗口，设置窗口聚焦事件
    if (this.mainWindow) {
      // 窗口聚焦时禁用按键
      this.mainWindow.on('focus', () => {
        try {
          const result = nativeKeyBlocker.disableAll();
          console.log('🔒 窗口聚焦，禁用系统按键，结果:', result);
        } catch (err) {
          console.error('❌ 禁用按键失败:', err.message);
        }
      });
    }

    console.log('✅ 原生按键拦截已配置');
  }

  /**
   * 获取安全状态
   */
  getStatus() {
    return {
      initialized: this.isInitialized,
      windowLocked: !!this.lockInterval,
      nativeBlockerAvailable: !!nativeKeyBlocker,
      hotkeyBlockerAvailable: !!(hotkeyBlocker && hotkeyBlocker.start)
    };
  }

  /**
   * 清理资源
   */
  cleanup() {
    console.log('🧹 开始清理安全管理器资源...');

    // 清除窗口锁定定时器
    if (this.lockInterval) {
      clearInterval(this.lockInterval);
      this.lockInterval = null;
      console.log('✅ 窗口锁定定时器已清除');
    }

    // 恢复原生模块禁用的按键
    if (nativeKeyBlocker) {
      try {
        const result = nativeKeyBlocker.enableAll();
        console.log('✅ 原生按键已恢复，结果:', result);
      } catch (err) {
        console.error('❌ 恢复按键失败:', err.message);
      }
    }

    // 停止热键拦截
    try {
      if (hotkeyBlocker && hotkeyBlocker.stop) {
        hotkeyBlocker.stop();
        console.log('✅ 热键拦截已停止');
      }
    } catch (e) {
      console.warn('⚠️  停止热键拦截时出错:', e.message);
    }

    this.isInitialized = false;
    this.mainWindow = null;
    console.log('✅ 安全管理器清理完成');
  }
}

// 导出单例
module.exports = new SecurityManager();