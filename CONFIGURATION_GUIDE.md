# 配置文件说明文档

在命令行中输入
```bash
notepad "C:\Users\YourUsername\AppData\Roaming\web-navigation-container\configs\config.json"
```
注意：将YourUsername替换为你的用户名(admin、Didun)

## 整体结构

配置文件主要包含以下几个部分：
- `apps`: 应用列表配置
- `interface`: 界面显示配置
- `initVideo`: 初始化视频配置
- `background`: 背景配置
- `layout`: 布局配置
- `carousel`: 轮播图配置
- `icon`: 图标配置
- `spacing`: 间距配置
- `dock`: Dock栏配置
- `window`: 窗口配置

## 配置项详解

### apps（应用列表）

应用列表定义了在主界面显示的所有应用程序。

每个应用包含以下属性：
- `id`: 应用唯一标识符
- `name`: 应用显示名称
- `type`: 应用类型（web/image/local）
- `url`: 应用链接地址（对于web类型）或特殊标识符
- `icon`: 应用图标文件名
- `visible`: 是否可见

示例：
```json
{
  "id": "flow-modeling",
  "name": "流程化建模",
  "type": "web",
  "url": "https://www.baidu.com",
  "icon": "icons8-flow-chart-100.png",
  "visible": true
}
```

### interface（界面配置）

控制界面元素的显示：

- `showSettingsButton`: 是否显示设置按钮（目前隐藏设置的方式是把应用列表中的设置删除或者设置`"visible": false`）

### initVideo（初始化视频）

启动时播放的初始化视频配置：

- `enabled`: 是否启用初始化视频（默认: true）
- `path`: 视频文件路径（默认: "assets/load/init.mp4"）

### background（背景配置）

主界面背景设置：

- `imageUrl`: 背景图片路径（默认: "assets/background/default.png"）
- `overlayOpacity`: 覆盖层透明度（0-100，默认: 0）
- `blur`: 背景模糊度（0-100，默认: 20）

### layout（布局配置）

图标排列布局：

- `columns`: 每行显示的图标列数（默认: 8）
- `rows`: 每列显示的图标行数（默认: 6）

### carousel（轮播图配置）

首页轮播图设置：

- `enabled`: 是否启用轮播图（默认: true）
- `random`: 是否随机播放（默认: false）
- `images`: 轮播图片路径数组
- `switchTime`: 切换动画时间（毫秒，默认: 3000）
- `displayDuration`: 每张图片显示时间（毫秒，默认: 9000）

### icon（图标配置）

应用图标样式设置：

- `hideName`: 是否隐藏图标名称（默认: false）
- `showShadow`: 是否显示图标阴影（默认: false）
- `enableAnimation`: 是否启用图标动画（默认: false）
- `showBackground`: 是否显示图标背景（默认: false）
- `size`: 图标大小（像素，默认: 105）
- `glow`: 图标发光效果配置
  - `enabled`: 是否启用发光效果（默认: true）
  - `color`: 发光颜色（默认: "#FF90C0"）
  - `opacity`: 发光透明度（默认: 0.24）
  - `blur`: 发光模糊度（默认: 14）
  - `height`: 发光高度（默认: 10）
  - `spread`: 发光扩散度（默认: 30）

### spacing（间距配置）

界面间距调整：

- `containerPaddingVertical`: 容器垂直内边距（0-200px，默认: 200）
- `containerPaddingHorizontal`: 容器水平内边距（0-200px，默认: 100）
- `iconGap`: 图标间距（像素，默认: 8）

### dock（Dock栏配置）

底部Dock栏样式设置：

- `backgroundColor`: 背景颜色（默认: "#205a7e"）
- `backgroundOpacity`: 背景透明度（0-100%，默认: 90）
- `blur`: 背景模糊度（0-40px，默认: 0）

### window（窗口配置）

主窗口样式设置：

- `borderColor`: 窗口边框颜色（默认: "#3300ff"）
- `titleColor`: 窗口标题文字颜色（默认: "#ffffff"）
- `headerBackgroundColor`: 窗口标题栏背景颜色（默认: "#38698a"）

## 配置修改注意事项

1. 修改配置文件后需要重启应用才能生效
2. 颜色值请使用标准十六进制格式（如 #RRGGBB）
3. 路径配置请确保文件存在且路径正确
4. 数值型配置项请注意取值范围
5. 布尔型配置项仅接受 true 或 false