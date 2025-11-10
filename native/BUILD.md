# Windows 原生热键拦截模块编译指南

## 环境要求

### Windows 平台
1. **Visual Studio Build Tools** (推荐 2019 或更高)
   - 下载地址: https://visualstudio.microsoft.com/zh-hans/downloads/
   - 选择 "使用 C++ 的桌面开发" 工作负载
   
2. **Python** (推荐 3.x)
   - 下载地址: https://www.python.org/downloads/

3. **Node.js** (已安装)

## 编译步骤

### 1. 进入原生模块目录
```bash
cd native
```

### 2. 安装依赖
```bash
npm install
```

### 3. 编译原生模块
```bash
npm run install
# 或
node-gyp rebuild
```

### 4. 验证编译结果
编译成功后会在 `native/build/Release/` 目录生成 `hotkey_blocker.node` 文件

## 使用方法

编译完成后，在主项目中正常启动即可：

```bash
cd ..
npm start
```

## 功能说明

原生模块会拦截以下系统快捷键：
- **Win 键** 及所有 Win 组合键（Win+D、Win+E 等）
- **Alt+Tab** - 任务切换
- **Alt+F4** - 关闭窗口
- **Ctrl+Esc** - 开始菜单
- **Alt+Esc** - 循环切换窗口
- **Ctrl+Shift+Esc** - 任务管理器

## 故障排除

### 编译失败
1. 确认已安装 Visual Studio Build Tools
2. 检查 Python 是否在 PATH 中
3. 以管理员身份运行命令提示符

### 运行时权限错误
应用需要**管理员权限**才能设置低级键盘钩子：
- 右键应用 -> 以管理员身份运行

### macOS/Linux 平台
原生模块仅在 Windows 平台可用，其他平台会自动降级为空实现（不影响应用运行）

## API 说明

```javascript
const hotkeyBlocker = require('./utils/hotkeyBlocker');

// 启动热键拦截
const success = hotkeyBlocker.start();

// 检查状态
const active = hotkeyBlocker.isActive();

// 停止热键拦截
hotkeyBlocker.stop();
```