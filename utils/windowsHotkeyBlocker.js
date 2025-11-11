/**
 * Windows 平台专用热键拦截器
 * 使用 Low-Level Keyboard Hook 实现完整的热键拦截
 * 仅在 Windows 平台可用
 */

const koffi = require('koffi');

class WindowsHotkeyBlocker {
  constructor(config = {}) {
    this.platform = process.platform;
    
    // 检查平台
    if (this.platform !== 'win32') {
      throw new Error('WindowsHotkeyBlocker 仅支持 Windows 平台');
    }

    // 配置
    this.config = {
      blockWinKey: true,
      blockAltTab: true,
      blockAltF4: true,
      blockCtrlAltDel: true,
      blockWinTab: true,
      blockCtrlEsc: true,
      blockAltEsc: true,
      ...config
    };

    // Windows API
    this.user32 = null;
    this.hookHandle = null;
    this.hookCallback = null;
    
    // 钩子常量
    this.WH_KEYBOARD_LL = 13;
    this.HC_ACTION = 0;
    this.WM_KEYDOWN = 0x0100;
    this.WM_KEYUP = 0x0101;
    this.WM_SYSKEYDOWN = 0x0104;
    this.WM_SYSKEYUP = 0x0105;

    // 虚拟键码
    this.VK = {
      LWIN: 0x5B,
      RWIN: 0x5C,
      TAB: 0x09,
      F4: 0x73,
      DELETE: 0x2E,
      ESCAPE: 0x1B,
      CONTROL: 0x11,
      MENU: 0x12,    // Alt key
      SHIFT: 0x10,
      SPACE: 0x20,
      ENTER: 0x0D,
      BACK: 0x08     // Backspace
    };

    this.isEnabled = false;
  }

  /**
   * 初始化 Windows API
   */
  initialize() {
    try {
      // 加载 user32.dll
      this.user32 = koffi.load('user32.dll');

      // 定义 KBDLLHOOKSTRUCT 结构
      this.KBDLLHOOKSTRUCT = koffi.struct('KBDLLHOOKSTRUCT', {
        vkCode: 'uint32',
        scanCode: 'uint32',
        flags: 'uint32',
        time: 'uint32',
        dwExtraInfo: 'uintptr'
      });

      // 定义回调函数类型 - 使用指针类型
      // 注意: Koffi 需要特殊的方式处理回调函数
      const LowLevelKeyboardProcType = koffi.proto('intptr __stdcall(int nCode, uintptr wParam, KBDLLHOOKSTRUCT *lParam)');
      
      // 加载 Windows API 函数
      this.SetWindowsHookExW = this.user32.func('SetWindowsHookExW', 'intptr', [
        'int',          // idHook
        'void*',        // lpfn (使用 void* 而不是 proto)
        'intptr',       // hMod
        'uint32'        // dwThreadId
      ]);

      this.UnhookWindowsHookEx = this.user32.func('UnhookWindowsHookEx', 'bool', ['intptr']);
      this.CallNextHookEx = this.user32.func('CallNextHookEx', 'intptr', ['intptr', 'int', 'uintptr', 'void*']);
      this.GetModuleHandleW = this.user32.func('GetModuleHandleW', 'intptr', ['str16']);
      this.GetAsyncKeyState = this.user32.func('GetAsyncKeyState', 'short', ['int']);
      
      // 保存回调类型以便后续使用
      this.callbackType = LowLevelKeyboardProcType;

      console.log('✓ Windows 热键拦截器初始化成功');
      return true;
    } catch (error) {
      console.error('✗ Windows 热键拦截器初始化失败:', error.message);
      return false;
    }
  }

  /**
   * 检查修饰键状态
   */
  isKeyPressed(vkCode) {
    return (this.GetAsyncKeyState(vkCode) & 0x8000) !== 0;
  }

  /**
   * 启用热键拦截
   */
  enable() {
    if (this.isEnabled) {
      console.log('⚠ 热键拦截已启用');
      return true;
    }

    if (!this.SetWindowsHookExW) {
      console.error('✗ Windows API 未初始化');
      return false;
    }

    try {
      // 创建键盘钩子回调函数
      const hookCallback = (nCode, wParam, lParam) => {
        if (nCode === this.HC_ACTION) {
          const vkCode = lParam.vkCode;
          const isKeyDown = (wParam === this.WM_KEYDOWN || wParam === this.WM_SYSKEYDOWN);

          if (isKeyDown) {
            // 检查修饰键状态
            const ctrlPressed = this.isKeyPressed(this.VK.CONTROL);
            const altPressed = this.isKeyPressed(this.VK.MENU);
            const shiftPressed = this.isKeyPressed(this.VK.SHIFT);
            const winPressed = this.isKeyPressed(this.VK.LWIN) || this.isKeyPressed(this.VK.RWIN);

            // Win 键本身
            if (this.config.blockWinKey && (vkCode === this.VK.LWIN || vkCode === this.VK.RWIN)) {
              console.log('✗ 拦截: Win 键');
              return 1;
            }

            // Ctrl+Alt+Delete
            if (this.config.blockCtrlAltDel && ctrlPressed && altPressed && vkCode === this.VK.DELETE) {
              console.log('✗ 拦截: Ctrl+Alt+Delete');
              return 1;
            }

            // Alt+F4
            if (this.config.blockAltF4 && altPressed && vkCode === this.VK.F4) {
              console.log('✗ 拦截: Alt+F4');
              return 1;
            }

            // Alt+Tab
            if (this.config.blockAltTab && altPressed && vkCode === this.VK.TAB) {
              console.log('✗ 拦截: Alt+Tab');
              return 1;
            }

            // Win+Tab
            if (this.config.blockWinTab && winPressed && vkCode === this.VK.TAB) {
              console.log('✗ 拦截: Win+Tab');
              return 1;
            }

            // Ctrl+Esc (开始菜单)
            if (this.config.blockCtrlEsc && ctrlPressed && vkCode === this.VK.ESCAPE) {
              console.log('✗ 拦截: Ctrl+Esc');
              return 1;
            }

            // Alt+Esc
            if (this.config.blockAltEsc && altPressed && vkCode === this.VK.ESCAPE) {
              console.log('✗ 拦截: Alt+Esc');
              return 1;
            }

            // Win+D (显示桌面)
            if (this.config.blockWinKey && winPressed && vkCode === 0x44) { // D key
              console.log('✗ 拦截: Win+D');
              return 1;
            }

            // Win+L (锁定计算机)
            if (this.config.blockWinKey && winPressed && vkCode === 0x4C) { // L key
              console.log('✗ 拦截: Win+L');
              return 1;
            }

            // Win+E (资源管理器)
            if (this.config.blockWinKey && winPressed && vkCode === 0x45) { // E key
              console.log('✗ 拦截: Win+E');
              return 1;
            }

            // Win+R (运行)
            if (this.config.blockWinKey && winPressed && vkCode === 0x52) { // R key
              console.log('✗ 拦截: Win+R');
              return 1;
            }
          }
        }

        // 传递给下一个钩子
        return this.CallNextHookEx(null, nCode, wParam, lParam);
      };
      
      // 使用 Koffi 创建回调 - 关键: 使用 register 方法
      this.hookCallback = koffi.register(hookCallback, this.callbackType);

      // 获取模块句柄
      const hModule = this.GetModuleHandleW(null);

      // 安装键盘钩子 - 传入注册后的回调
      this.hookHandle = this.SetWindowsHookExW(
        this.WH_KEYBOARD_LL,
        this.hookCallback,
        hModule,
        0
      );

      if (!this.hookHandle || this.hookHandle === 0) {
        console.error('✗ 安装键盘钩子失败');
        return false;
      }

      this.isEnabled = true;
      console.log('✓ Windows 热键拦截已启用');
      this.printBlockedKeys();
      return true;
    } catch (error) {
      console.error('✗ 启用热键拦截失败:', error.message);
      return false;
    }
  }

  /**
   * 禁用热键拦截
   */
  disable() {
    if (!this.isEnabled) {
      console.log('⚠ 热键拦截未启用');
      return;
    }

    try {
      if (this.hookHandle && this.UnhookWindowsHookEx) {
        this.UnhookWindowsHookEx(this.hookHandle);
        this.hookHandle = null;
        this.hookCallback = null;
        this.isEnabled = false;
        console.log('✓ Windows 热键拦截已禁用');
      }
    } catch (error) {
      console.error('✗ 禁用热键拦截失败:', error.message);
    }
  }

  /**
   * 检查是否已启用
   */
  isActive() {
    return this.isEnabled;
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig) {
    const wasEnabled = this.isEnabled;
    
    if (wasEnabled) {
      this.disable();
    }

    this.config = { ...this.config, ...newConfig };

    if (wasEnabled) {
      this.enable();
    }

    console.log('✓ 配置已更新');
  }

  /**
   * 获取当前配置
   */
  getConfig() {
    return { ...this.config };
  }

  /**
   * 打印被拦截的快捷键
   */
  printBlockedKeys() {
    console.log('\n拦截的快捷键列表:');
    if (this.config.blockWinKey) {
      console.log('  ✓ Win 键 (及所有 Win+ 组合)');
    }
    if (this.config.blockAltTab) {
      console.log('  ✓ Alt+Tab');
    }
    if (this.config.blockAltF4) {
      console.log('  ✓ Alt+F4');
    }
    if (this.config.blockCtrlAltDel) {
      console.log('  ✓ Ctrl+Alt+Delete');
    }
    if (this.config.blockWinTab) {
      console.log('  ✓ Win+Tab');
    }
    if (this.config.blockCtrlEsc) {
      console.log('  ✓ Ctrl+Esc');
    }
    if (this.config.blockAltEsc) {
      console.log('  ✓ Alt+Esc');
    }
    console.log('');
  }
}

module.exports = WindowsHotkeyBlocker;
