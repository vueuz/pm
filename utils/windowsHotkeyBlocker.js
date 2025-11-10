/**
 * Windows 平台专用热键拦截器
 * 使用 Low-Level Keyboard Hook 实现完整的热键拦截
 * 仅在 Windows 平台可用
 */

const koffi = require('koffi');

// Windows 热键拦截：使用原生 C++ 模块实现底层键盘钩子
const path = require('path');

let nativeAddon = null;

try {
  nativeAddon = require(path.join(__dirname, '../native'));
} catch (e) {
  console.warn('原生热键拦截模块未编译，请在 native 目录运行: npm install');
  console.warn('错误详情:', e.message);
}

function start() {
  if (!nativeAddon) {
    console.warn('原生模块不可用，热键拦截功能未启用');
    return false;
  }

  try {
    const result = nativeAddon.start();
    if (result) {
      console.log('Windows 底层键盘钩子已启动');
      console.log('已拦截: Win键、Alt+Tab、Alt+F4、Ctrl+Esc、Alt+Esc、Ctrl+Shift+Esc');
    }
    return result;
  } catch (e) {
    console.error('启动键盘钩子失败:', e.message);
    console.error('提示：需要管理员权限运行应用');
    return false;
  }
}

function stop() {
  if (!nativeAddon) return true;

  try {
    nativeAddon.stop();
    console.log('Windows 底层键盘钩子已停止');
    return true;
  } catch (e) {
    console.warn('停止键盘钩子时出错:', e.message);
    return false;
  }
}

function isActive() {
  if (!nativeAddon) return false;
  try {
    return nativeAddon.isActive();
  } catch (e) {
    return false;
  }
}

module.exports = { start, stop, isActive };
