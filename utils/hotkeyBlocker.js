const koffi = require('koffi');
const { app } = require('electron');

// Windows 专用拦截器
let WindowsHotkeyBlocker = null;
if (process.platform === 'win32') {
  try {
    WindowsHotkeyBlocker = require('./windowsHotkeyBlocker');
  } catch (error) {
    console.error('加载 Windows 热键拦截器失败:', error);
  }
}

/**
 * 热键拦截管理器
 * 使用 FFI 调用系统 API 来禁用全局热键
 * 支持平台: Windows, macOS
 */
class HotkeyBlocker {
  constructor() {
    this.platform = process.platform;
    this.isEnabled = false;
    this.hooks = [];
    
    // Windows API
    this.winLib = null;
    this.hookProc = null;
    this.hookHandle = null;
    
    // macOS API
    this.macLib = null;
    this.eventTap = null;
    this.runLoopSource = null;
  }

  /**
   * 初始化平台特定的 API
   */
  initialize() {
    try {
      if (this.platform === 'win32') {
        // Windows 使用专用拦截器
        if (WindowsHotkeyBlocker) {
          this.windowsBlocker = new WindowsHotkeyBlocker();
          return this.windowsBlocker.initialize();
        } else {
          console.log('Windows 专用拦截器不可用');
          return false;
        }
      } else if (this.platform === 'darwin') {
        return this.initMacOS();
      } else {
        console.log('不支持的平台:', this.platform);
        return false;
      }
    } catch (error) {
      console.error('初始化热键拦截器失败:', error);
      return false;
    }
  }

  /**
   * macOS 平台初始化
   * 注意: macOS 上使用 FFI 调用 CGEvent API 比较复杂
   * 这里提供一个简化的实现,主要依赖 Electron 的 globalShortcut
   * 对于更底层的拦截,建议使用 Swift/Objective-C 编写原生模块
   */
  initMacOS() {
    console.log('macOS 平台: 使用 Electron globalShortcut 作为主要拦截方式');
    console.log('注意: macOS 系统限制,某些快捷键可能无法完全拦截');
    console.log('建议: 结合 Electron globalShortcut API 使用');
    
    // macOS 上 CGEvent API 的 FFI 调用比较复杂
    // 由于 Koffi 对函数指针回调的限制,这里标记为已初始化
    // 实际拦截由 Electron globalShortcut 处理
    return true;
  }

  /**
   * 启用热键拦截
   */
  enable() {
    if (this.isEnabled) {
      console.log('热键拦截已启用');
      return true;
    }

    try {
      if (this.platform === 'win32') {
        if (this.windowsBlocker) {
          return this.windowsBlocker.enable();
        }
        return false;
      } else if (this.platform === 'darwin') {
        return this.enableMacOS();
      }
      return false;
    } catch (error) {
      console.error('启用热键拦截失败:', error);
      return false;
    }
  }

  /**
   * macOS 平台启用拦截
   * 注意: 由于 FFI 限制,macOS 上主要依赖 Electron globalShortcut
   */
  enableMacOS() {
    console.log('macOS 平台: 热键拦截主要通过 Electron globalShortcut 实现');
    console.log('已在 main.js 中注册以下快捷键:');
    console.log('  - Command+Tab (应用切换)');
    console.log('  - Alt+Tab (备用)');
    
    this.isEnabled = true;
    return true;
  }

  /**
   * 禁用热键拦截
   */
  disable() {
    if (!this.isEnabled && (!this.windowsBlocker || !this.windowsBlocker.isActive())) {
      console.log('热键拦截未启用');
      return;
    }

    try {
      if (this.platform === 'win32') {
        if (this.windowsBlocker) {
          this.windowsBlocker.disable();
        }
      } else if (this.platform === 'darwin') {
        this.disableMacOS();
      }
      
      this.isEnabled = false;
      console.log('热键拦截已禁用');
    } catch (error) {
      console.error('禁用热键拦截失败:', error);
    }
  }

  /**
   * macOS 平台禁用拦截
   */
  disableMacOS() {
    console.log('macOS 平台: 禁用热键拦截');
    // 实际拦截由 Electron globalShortcut 管理
  }

  /**
   * 检查是否已启用
   */
  isActive() {
    if (this.platform === 'win32' && this.windowsBlocker) {
      return this.windowsBlocker.isActive();
    }
    return this.isEnabled;
  }

  /**
   * 更新配置 (仅 Windows)
   */
  updateConfig(config) {
    if (this.platform === 'win32' && this.windowsBlocker) {
      this.windowsBlocker.updateConfig(config);
    }
  }

  /**
   * 获取配置 (仅 Windows)
   */
  getConfig() {
    if (this.platform === 'win32' && this.windowsBlocker) {
      return this.windowsBlocker.getConfig();
    }
    return null;
  }
}

// 导出单例
let instance = null;

module.exports = {
  getInstance: () => {
    if (!instance) {
      instance = new HotkeyBlocker();
    }
    return instance;
  },
  HotkeyBlocker
};

// 平台统一入口：根据操作系统加载对应实现

let impl = null;

function start() {
  try {
    if (process.platform === 'win32') {
      impl = require('./windowsHotkeyBlocker');
      return impl.start();
    }
    return false;
  } catch (e) {
    console.warn('hotkeyBlocker.start error:', e && e.message);
    return false;
  }
}

function stop() {
  try {
    if (impl && typeof impl.stop === 'function') {
      impl.stop();
    }
  } catch (e) {
    console.warn('hotkeyBlocker.stop error:', e && e.message);
  }
}

module.exports = { start, stop };
