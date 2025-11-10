// Native addon 入口
try {
  const addon = require('./build/Release/hotkey_blocker.node');
  module.exports = addon;
} catch (err) {
  console.warn('原生热键拦截模块加载失败，仅在 Windows 平台可用:', err.message);
  // 提供降级接口
  module.exports = {
    start: () => false,
    stop: () => true,
    isActive: () => false
  };
}