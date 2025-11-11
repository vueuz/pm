const assert = require("assert");
const { disableAll, enableAll } = require("./index");

const platform = process.platform;
const superKeyName = platform === "win32" ? "Windows键" : "Command键";
const appSwitchName = platform === "win32" ? "Alt+Tab" : "Command+Tab";
const altKeyName = platform === "win32" ? "Alt键" : "Option键";
const ctrlKeyName = platform === "win32" ? "Ctrl键" : "Control键";

console.log(`[测试] 开始在 ${platform} 平台进行按键禁用测试...`);

try {
  let timer = null;
  // 2. 禁用所有按键
  console.log(`[测试] 正在禁用`);
  disableAll();
  let count = 0;

  timer = setInterval(() => {
    count++;
    if (count % 2 == 0) {
      disableAll();
    } else {
      enableAll();
    }
    console.log(`count: ${count}, ${count % 2 == 0 ? "禁用" : "恢复"}`);
  }, 5000);

  // 4. 等待用户手动测试，然后按 Ctrl+C
  const keepAlive = setInterval(() => {
    // 保持进程运行
  }, 1000);

  const cleanup = () => {
    clearInterval(timer);
    clearInterval(keepAlive);
    console.log(
      `\n[测试] 正在恢复 ${superKeyName}、${appSwitchName}、${altKeyName}、F11键、${ctrlKeyName} 和 F3键...`
    );
    enableAll();
    console.log("[测试] 测试成功结束。");
    process.exit(0);
  };

  // 处理 Ctrl+C
  process.on("SIGINT", cleanup);

  // 确保在任何情况下退出时都能恢复
  process.on("exit", () => {
    enableAll();
  });
} catch (error) {
  console.error("[测试] 测试失败:", error.message);
  // 确保在失败时也能恢复按键
  enableAll();
  process.exit(1);
}
