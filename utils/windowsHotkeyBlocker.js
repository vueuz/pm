/**
 * Windows 平台专用热键拦截器
 * 使用 Low-Level Keyboard Hook 实现完整的热键拦截
 * 仅在 Windows 平台可用
 */

const koffi = require('koffi');

// Windows 热键拦截：使用 koffi 绑定 Win32 低级键盘钩子
const koffi = require('koffi');

// 按键常量
const WH_KEYBOARD_LL = 13;
const WM_KEYDOWN = 0x0100;
const WM_KEYUP = 0x0101;
const WM_SYSKEYDOWN = 0x0104;
const WM_SYSKEYUP = 0x0105;

const VK_TAB = 0x09;
const VK_MENU = 0x12; // ALT
const VK_CONTROL = 0x11; // CTRL
const VK_ESCAPE = 0x1B;
const VK_F4 = 0x73;
const VK_LWIN = 0x5B;
const VK_RWIN = 0x5C;

// 结构体定义
const KBDLLHOOKSTRUCT = koffi.struct('KBDLLHOOKSTRUCT', {
  vkCode: 'uint32',
  scanCode: 'uint32',
  flags: 'uint32',
  time: 'uint32',
  dwExtraInfo: 'pointer',
});

// 加载 DLL
let user32 = null;
let kernel32 = null;
let hookHandle = null;
let callbackRef = null;

function ensureLibs() {
  if (!user32) {
    user32 = koffi.load('user32.dll');
    // 函数签名绑定
    user32.func('SetWindowsHookExW', 'void*', ['int', 'pointer', 'void*', 'uint32']);
    user32.func('UnhookWindowsHookEx', 'bool', ['void*']);
    user32.func('CallNextHookEx', 'long', ['void*', 'int', 'uint', 'pointer']);
    user32.func('GetAsyncKeyState', 'short', ['int']);
    user32.func('PostThreadMessageW', 'bool', ['uint32', 'uint', 'uintptr', 'uintptr']);
  }
  if (!kernel32) {
    kernel32 = koffi.load('kernel32.dll');
    kernel32.func('GetCurrentThreadId', 'uint32', []);
  }
}

function isDown(vk) {
  // 高位 0x8000 表示按下
  return (user32.GetAsyncKeyState(vk) & 0x8000) !== 0;
}

// 低级键盘钩子回调
const LowLevelKeyboardProc = koffi.callback('LowLevelKeyboardProc', 'long', ['int', 'uint', 'pointer']);

function keyboardProc(nCode, wParam, lParamPtr) {
  try {
    if (nCode < 0) {
      return user32.CallNextHookEx(hookHandle, nCode, wParam, lParamPtr);
    }
    const info = koffi.decode(lParamPtr, KBDLLHOOKSTRUCT);
    const vk = info.vkCode >>> 0;

    const altDown = isDown(VK_MENU);
    const ctrlDown = isDown(VK_CONTROL);
    const winDown = isDown(VK_LWIN) || isDown(VK_RWIN);

    const keydown = (wParam === WM_KEYDOWN || wParam === WM_SYSKEYDOWN);

    if (keydown) {
      // 屏蔽 Win 键
      if (winDown || vk === VK_LWIN || vk === VK_RWIN) {
        return 1; // 拦截
      }
      // 屏蔽 Alt+Tab
      if (altDown && vk === VK_TAB) {
        return 1;
      }
      // 屏蔽 Alt+F4
      if (altDown && vk === VK_F4) {
        return 1;
      }
      // 屏蔽 Ctrl+Esc / Alt+Esc
      if ((ctrlDown && vk === VK_ESCAPE) || (altDown && vk === VK_ESCAPE)) {
        return 1;
      }
    }

    return user32.CallNextHookEx(hookHandle, nCode, wParam, lParamPtr);
  } catch (e) {
    // 出错时尽量不中断系统事件链
    try {
      return user32.CallNextHookEx(hookHandle, nCode, wParam, lParamPtr);
    } catch (_) {
      return 0;
    }
  }
}

function start() {
  if (hookHandle) return true;
  if (process.platform !== 'win32') return false;
  ensureLibs();
  callbackRef = LowLevelKeyboardProc(keyboardProc);
  hookHandle = user32.SetWindowsHookExW(WH_KEYBOARD_LL, callbackRef, null, 0);
  if (!hookHandle) {
    throw new Error('SetWindowsHookExW 失败，可能需要管理员权限');
  }

  // 可选：保持线程消息循环（在 Node/Electron 主线程通常不需要）
  return true;
}

function stop() {
  try {
    if (hookHandle) {
      user32.UnhookWindowsHookEx(hookHandle);
      hookHandle = null;
    }
    callbackRef = null;
  } catch (e) {
    // 记录但不抛出
    console.warn('UnhookWindowsHookEx error:', e && e.message);
  }
}

module.exports = { start, stop };
