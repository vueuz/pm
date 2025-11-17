# 从密钥生成到授权激活全流程

## 系统概述

- 授权码由发行端使用 `RSA 私钥`对 `machineId|expiryTimestamp` 进行 `RSA-SHA256` 签名生成。
- 客户端持有 `RSA 公钥`，在启动与激活时验证签名与有效期，无需共享密钥。
- 授权码为 `base64( 机器指纹前8位-过期时间戳-签名(base64) )`，为了易读会按每4字符分组显示。

相关实现：
- 生成授权码：`utils/license.js:28` 的 `generateLicense`
- 验证授权码：`utils/license.js:64` 的 `verifyLicense`
- 保存授权码：`main.js:228` 的 `saveLicense`
- 启动校验：`main.js:178` 的 `checkLicenseOnStartup`
- IPC：获取机器指纹 `main.js:426`；激活 `main.js:434`；检查激活状态 `main.js:473`

## 准备工作

- 环境：Node.js 16+（含 Node `crypto` 模块）
- 文件结构：
  - 私钥（发行端保管）：`keys/private.pem`
  - 公钥（客户端使用）：`keys/public.pem` 或通过环境变量注入
- 发行端工具：`tools/generate-keys.js`、`tools/license-generator.js`

## 步骤一：生成密钥对（发行端）

- 使用内置脚本生成 2048 位 RSA 密钥：
  - `node tools/generate-keys.js`
  - 生成 `keys/private.pem` 与 `keys/public.pem`
- 安全要求：
  - 私钥仅保留在发行端，绝不放入客户端或代码仓库历史。
  - 可在 CI/运维中改用环境变量或外部密钥管理系统保管私钥。

（可替代方案）OpenSSL：
- 生成私钥：`openssl genrsa -out private.pem 2048`
- 导出公钥：`openssl rsa -in private.pem -pubout -out public.pem`

## 步骤二：在客户端部署公钥

- 两种方式任选其一：
  - 文件方式：将 `keys/public.pem` 放入应用包（默认路径，已纳入打包配置）。
  - 环境变量：`PM_LICENSE_PUBLIC_KEY` 注入 PEM 文本，或使用 `PM_LICENSE_PUBLIC_KEY_FILE` 提供文件路径。
- 客户端加载优先级：函数参数 > 环境变量 (`PM_LICENSE_PUBLIC_KEY` / `PM_LICENSE_PUBLIC_KEY_FILE`) > 默认文件路径。

生产环境注意：
- GUI 启动的应用通常不会继承终端中的 `export` 变量。
- macOS 可在 `Info.plist` 的 `LSEnvironment` 中设置 `PM_LICENSE_PUBLIC_KEY`；或使用启动脚本设置后再启动应用。
- Windows 可设置系统/用户环境变量，或通过启动器脚本 `set PM_LICENSE_PUBLIC_KEY=...` 后启动。
- 已支持在打包产物中查找 `process.resourcesPath/keys/public.pem` 及 `app.asar.unpacked/keys/public.pem`，无需额外配置即可使用文件方式。

## 步骤三：获取用户机器指纹

- 用户端打开激活窗口，界面会显示机器指纹（通过 IPC `get-machine-id`）。
- 或在命令行获取（发行端/用户提供）：
  - `node -e "(async()=>{const {getMachineId}=require('./utils/fingerprint');console.log(await getMachineId())})()"`

实现参考：
- 机器指纹生成：`utils/fingerprint.js:9` 的 `getMachineId`

## 步骤四：生成授权码（发行端）

- 使用发行工具：
  - `node tools/license-generator.js <机器指纹> <YYYY-MM-DD>`
  - 例如：`node tools/license-generator.js 0D766EA31CE268EE3C7D10196AD2A8AB 2026-12-31`
- 私钥来源优先级：环境变量 `PM_LICENSE_PRIVATE_KEY` > 默认文件 `keys/private.pem`
- 输出包含：授权码、到期日期、剩余天数。

实现参考：
- 授权生成：`tools/license-generator.js:78` 读取私钥并调用 `generateLicense`

## 步骤五：用户激活（客户端）

- 用户在激活窗口粘贴授权码，点击“激活”。
- 客户端流程：
  - 通过 IPC `activate-license` 将授权码与当前机器指纹送入验证。
  - 验证成功后写入 `license.dat`（路径：`app.getPath('userData')/license.dat`）。
  - 关闭激活窗口并进入主界面。

实现参考：
- 保存授权码：`main.js:228` 的 `saveLicense`
- 激活 IPC：`main.js:434` 的 `activate-license`

## 验证机制（客户端）

- 启动时：`checkLicenseOnStartup` 会读取 `license.dat` 并调用 `verifyLicense`：
  - 用公钥校验签名是否有效。
  - 校验机器指纹前缀是否匹配当前机器。
  - 校验过期时间是否已到期。
- 剩余天数小于 30 天会弹出续期提醒。

实现参考：
- 启动校验：`main.js:178` 的 `checkLicenseOnStartup`
- 验证函数：`utils/license.js:64` 的 `verifyLicense`

## 到期与续期

- 续期流程与首次授权一致：获取机器指纹 → 生成新授权码 → 用户粘贴激活。
- 不需要更新客户端公钥，只需发行端根据新的到期日期重新签发。

## 常见问题与排查

- 缺少公钥：报错“缺少公钥”
  - 解决：设置 `PM_LICENSE_PUBLIC_KEY` 或放置 `keys/public.pem`。
- 授权码格式错误/解码失败：
  - 可能是粘贴过程中丢失字符或包含多余空格。
  - 解决：确保完整复制授权码（包含分组破折号后也可用）。
- 机器不匹配：报错“授权码与当前机器不匹配”
  - 解决：重新确认机器指纹是否正确，避免抄错或旧指纹。
- 已过期：报错“授权码已过期”
  - 解决：发行端生成新的授权码（更新到期日期）。
- 私钥缺失（发行端）：报错“缺少私钥”
  - 解决：注入 `PM_LICENSE_PRIVATE_KEY` 或放置 `keys/private.pem`。

## 命令速查

- 生成密钥对：`node tools/generate-keys.js`
- 设置公钥环境变量：`export PM_LICENSE_PUBLIC_KEY="$(cat keys/public.pem)"`
- 设置私钥环境变量（发行端）：`export PM_LICENSE_PRIVATE_KEY="$(cat keys/private.pem)"`
- 获取机器指纹：
  - `node -e "(async()=>{const {getMachineId}=require('./utils/fingerprint');console.log(await getMachineId())})()"`
- 生成授权码：
  - `node tools/license-generator.js <机器指纹> <YYYY-MM-DD>`

## 便携的密钥生成工具

- `tools/generate-keys.js` 可直接复制到外部环境使用，不依赖项目其他模块。
- 你也可以改用 OpenSSL 或你的密钥管理系统以满足安全合规要求。
