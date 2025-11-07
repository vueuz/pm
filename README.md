# Web Navigation Container

基于 Electron 实现的导航页面应用，作为所有 Web 应用窗口的父容器，用于统一管理多个 Web 服务。

## 功能特性

1. **父容器行为**
   - 作为应用程序的主页面，展示所有内置应用的图标
   - 承载所有 Web 应用窗口
   - Web 服务在容器内部以子窗口展示，不作为独立系统窗口弹出

2. **内置应用**
   - 百度（https://www.baidu.com）
   - 必应（https://www.bing.com）
   - 设置（用于添加/删除 Web 应用入口）
   - 切换系统（退出导航页面应用）

3. **应用窗口管理**
   - 每个已启动 Web 应用以独立子窗口显示
   - 子窗口具备标题栏和窗口控制按钮
   - 不遮挡顶部状态栏和底部 Dock 栏

4. **Dock 栏**
   - 页面底部固定显示
   - 包含主页按钮和已启动/最小化应用图标
   - 应用启动后自动显示

5. **顶部状态栏**
   - 固定在页面顶端
   - 显示硬件状态（CPU、GPU、内存）
   - 显示服务状态（LLM 服务）
   - 显示实时时间和日期

## 项目结构

```
.
├── main.js              # Electron 主进程入口
├── preload.js           # 预加载脚本
├── package.json         # 项目配置文件
├── renderer/
│   ├── index.html       # 主页面
│   ├── renderer.js      # 渲染进程主脚本
│   ├── styles/
│   │   └── main.css     # 主样式表
│   └── assets/
│       └── icons/       # 图标文件
```

## 安装和运行

1. 安装依赖：
   ```
   npm install
   ```

2. 启动应用：
   ```
   npm start
   ```

## 开发说明

### 主要模块

- **main.js**: Electron 主进程，负责创建主容器窗口，监听应用退出等事件
- **preload.js**: 主进程和渲染进程通信桥梁
- **renderer/index.html**: 渲染进程主页面
- **renderer/renderer.js**: 渲染进程逻辑处理
- **renderer/styles/main.css**: 样式定义

### 扩展功能

可以通过修改 `configs/config.json` 文件中的 `apps` 数组来添加更多应用。系统支持三种应用形态：

#### 1. Web应用 (`type: "web"`)
通过 iframe 嵌入网页应用：

```javascript
{
  "id": "baidu",
  "name": "百度",
  "type": "web",
  "url": "https://www.baidu.com",
  "icon": "icons8-search-100.png",
  "visible": true
}
```

#### 2. 图片应用 (`type: "image"`)
显示图片文件，图片会自动适应窗口大小，无滚动条：

```javascript
{
  "id": "diagram",
  "name": "系统架构图",
  "type": "image",
  "url": "assets/images/architecture.png",
  "icon": "icons8-picture-100.png",
  "visible": true
}
```

#### 3. 本地应用 (`type: "local"`)
启动本地可执行程序：

```javascript
{
  "id": "calculator",
  "name": "计算器",
  "type": "local",
  "path": "/Applications/Calculator.app",  // macOS
  // "path": "C:\\Windows\\System32\\calc.exe",  // Windows
  "icon": "icons8-calculator-100.png",
  "visible": true
}
```

**注意**：
- Web应用使用 `url` 字段
- 图片应用使用 `url` 或 `path` 字段，指向图片文件路径
- 本地应用使用 `path` 字段，指向可执行文件路径
- 本地应用路径应使用绝对路径
- Windows路径中的反斜杠需要转义 `\\`

## 技术特点

- 使用 Electron 构建跨平台桌面应用
- 基于 BrowserWindow 和 iframe 实现 Web 应用容器
- 响应式设计适配不同屏幕尺寸
- 系统信息监控（CPU、内存等）
- 类似操作系统的窗口管理体验