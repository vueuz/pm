// 安全管理模块：统一管理窗口锁定和热键拦截
const configManager = require('./configManager');

class SecurityManager {
  constructor() {
    this.lockInterval = null;
    this.hotkeyBlocker = null;
    this.mainWindow = null;
  }

  /**
   * 初始化安全管理器
   * @param {BrowserWindow} window - 主窗口引用
   */
  initialize(window) {
    this.mainWindow = window;
    const config = configManager.getConfig();
    const security = config.security || {};

    // 启动窗口锁定
    if (security.windowLock !== false) {
      this.startWindowLock(security.lockCheckInterval || 1000);
    }

    // 启动热键拦截（仅 Windows）
    if (security.hotkeyBlock !== false && process.platform === 'win32') {
      this.startHotkeyBlock();
    }

    console.log('安全管理器已初始化');
  }

  /**
   * 启动窗口锁定
   */
  startWindowLock(interval = 1000) {
    if (!this.mainWindow) return;

    const config = configManager.getConfig();
    const security = config.security || {};

    // 初始设置
    this.mainWindow.setAlwaysOnTop(true, 'screen-saver');
    this.mainWindow.setFullScreen(true);
    this.mainWindow.setFocusable(true);
    this.mainWindow.setSkipTaskbar(true);

    // 定时检查
    this.lockInterval = setInterval(() => {
      if (!this.mainWindow || this.mainWindow.isDestroyed()) {
        this.stopWindowLock();
        return;
      }

      try {
        // 防止最小化
        if (security.preventMinimize !== false && this.mainWindow.isMinimized()) {
          this.mainWindow.restore();
        }

        // 防止失焦
        if (security.preventFocusLoss !== false && !this.mainWindow.isFocused()) {
          this.mainWindow.focus();
        }

        // 保持全屏
        if (!this.mainWindow.isFullScreen()) {
          this.mainWindow.setFullScreen(true);
        }

        // 保持置顶
        this.mainWindow.setAlwaysOnTop(true, 'screen-saver');
      } catch (e) {
        console.warn('窗口锁定检查时出错:', e.message);
      }
    }, interval);

    console.log(`窗口锁定已启动（检查间隔: ${interval}ms）`);
  }

  /**
   * 停止窗口锁定
   */
  stopWindowLock() {
    if (this.lockInterval) {
      clearInterval(this.lockInterval);
      this.lockInterval = null;
      console.log('窗口锁定已停止');
    }
  }

  /**
   * 启动热键拦截
   */
  startHotkeyBlock() {
    try {
      this.hotkeyBlocker = require('./hotkeyBlocker');
      const success = this.hotkeyBlocker.start();
      
      if (success) {
        console.log('热键拦截已启动');
      } else {
        console.warn('热键拦截启动失败（可能需要管理员权限）');
      }
    } catch (e) {
      console.warn('热键拦截模块加载失败:', e.message);
    }
  }

  /**
   * 停止热键拦截
   */
  stopHotkeyBlock() {
    if (this.hotkeyBlocker) {
      try {
        this.hotkeyBlocker.stop();
        console.log('热键拦截已停止');
      } catch (e) {
        console.warn('停止热键拦截时出错:', e.message);
      }
    }
  }

  /**
   * 获取安全状态
   */
  getStatus() {
    return {
      windowLockActive: !!this.lockInterval,
      hotkeyBlockActive: this.hotkeyBlocker && 
        typeof this.hotkeyBlocker.isActive === 'function' ? 
        this.hotkeyBlocker.isActive() : false,
      platform: process.platform
    };
  }

  /**
   * 清理资源
   */
  cleanup() {
    this.stopWindowLock();
    this.stopHotkeyBlock();
    this.mainWindow = null;
    console.log('安全管理器已清理');
  }
}

// 导出单例
module.exports = new SecurityManager();