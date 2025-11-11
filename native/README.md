# 按键禁用插件 (Node.js C++ Addon)

这是一个用于禁用特定按键的 Node.js C++ Addon 库，支持在 Windows 和 macOS 系统上禁用多种按键组合，包括 Super 键（Windows 键/Command 键）、应用切换快捷键、功能键等。

本项目提供跨平台的实现，可在 Windows 和 macOS 环境下无缝运行。

## 功能特性

- **跨平台支持**：同时支持 Windows 和 macOS 系统
- **禁用 Super 键**：禁用 Windows 键或 macOS 的 Command 键
- **禁用应用切换**：禁用 Alt+Tab 或 Command+Tab
- **禁用 Alt 键**：禁用 Alt 键 (Windows) 或 Option 键 (macOS)
- **禁用 F11 键**：防止意外全屏切换
- **禁用 Ctrl 键**：禁用 Ctrl 键 (Windows) 或 Control 键 (macOS)
- **禁用 F3 键**：禁用 F3 功能键
- **禁用 Fn 键**：禁用 Fn 功能键及组合键
- **禁用所有功能键**：禁用 F1-F12 所有功能键
- **简洁 API**：提供统一的 `KeyManager` 类和独立函数调用方式
- **高性能**：使用原生代码实现，系统资源占用极低
- **自动资源清理**：程序退出时自动恢复按键功能

## 系统要求

- **操作系统**：Windows (x86, x64) 或 macOS (x64, arm64)
- **Node.js**：>= 14.0.0
- **构建工具**：
  - Windows：Visual Studio Build Tools (含 C++ 编译器)
  - macOS：Xcode Command Line Tools

## 安装

```bash
# 克隆或下载项目
# 安装依赖并自动编译原生插件
npm install
```

手动编译：
```bash
npm run build
```

## 在 Electron 中使用

在 Electron 应用中使用本模块需要特别注意，因为原生模块必须针对 Electron 内置的 Node.js 版本编译。

### 方式一：使用 electron-rebuild（推荐）

**1. 安装 electron-rebuild**

```bash
npm install --save-dev electron-rebuild
```

**2. 重新编译原生模块**

在 `package.json` 中添加：
```json
"scripts": {
  "start": "electron .",
  "rebuild": "electron-rebuild"
}
```

然后执行：
```bash
npm run rebuild
```

### 方式二：手动引入打包后的模块

1. 在本项目根目录运行 `npm install` 和 `npm run build`
2. 将 `build` 文件夹复制到 Electron 项目中
3. 在主进程代码中引入：

```javascript
// 路径需要根据实际情况调整
const addon = require('./native/build/Release/disable_winkey.node');

// 使用模块功能
addon.disableAll();
```

**注意**：此方法不推荐，因为手动复制的构建产物可能与 Electron 的 Node.js 版本不兼容。

### 在 Electron 主进程中使用

此类系统级键盘钩子功能**只能在 Electron 主进程中使用**：

```javascript
const { app, BrowserWindow } = require('electron');
const { disableAll, enableAll } = require('disable-winkey-addon');

function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600
  });

  win.loadFile('index.html');

  // 窗口聚焦时禁用按键
  win.on('focus', () => {
    console.log('窗口聚焦，禁用按键。');
    disableAll();
  });

  // 窗口失焦时恢复按键
  win.on('blur', () => {
    console.log('窗口失焦，恢复按键。');
    enableAll();
  });
}

app.whenReady().then(createWindow);

// 应用退出前恢复所有按键
app.on('will-quit', () => {
  console.log('应用即将退出，恢复所有按键。');
  enableAll();
});
```

## 在 Node.js 中使用

### 使用 KeyManager 类

```javascript
const { KeyManager } = require('disable-winkey-addon');

const keyManager = new KeyManager();

// 禁用所有按键
keyManager.disableAll();

// 恢复所有按键
keyManager.enableAll();
```

### 直接函数调用

```javascript
const { disableAll, enableAll } = require('disable-winkey-addon');

// 禁用所有按键
disableAll();

// 恢复所有按键
enableAll();
```

## API 参考

### KeyManager 类

- `disableAll()` - 禁用所有支持的按键
- `enableAll()` - 恢复所有按键功能

### 独立函数

- `disableAll()` - 禁用所有支持的按键
- `enableAll()` - 恢复所有按键功能

## 技术实现

本插件使用不同平台的原生 API 实现按键拦截：

- **Windows**：使用 Windows 低级键盘钩子 (WH_KEYBOARD_LL)
- **macOS**：使用 CoreGraphics 事件拦截 (CGEventTap)

## 许可证

MIT