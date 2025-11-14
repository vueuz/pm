const path = require('path');
const { app } = require('electron');

let addon;

try {
    // 尝试使用 bindings 加载（开发环境）
    const bindings = require('bindings');
    addon = bindings('disable_winkey');
} catch (err) {
    // 打包后的环境，需要手动指定路径
    try {
        const isDev = !app || !app.isPackaged;
        
        if (isDev) {
            // 开发环境：使用相对路径
            addon = require('./build/Release/disable_winkey.node');
        } else {
            // 生产环境：从 app.asar.unpacked 加载
            const unpackedPath = path.join(
                process.resourcesPath,
                'app.asar.unpacked',
                'native',
                'build',
                'Release',
                'disable_winkey.node'
            );
            
            // 检查文件是否存在
            const fs = require('fs');
            if (fs.existsSync(unpackedPath)) {
                addon = require(unpackedPath);
            } else {
                // 尝试其他可能的路径
                const alternativePath = path.join(
                    process.resourcesPath,
                    'native',
                    'build',
                    'Release',
                    'disable_winkey.node'
                );
                
                if (fs.existsSync(alternativePath)) {
                    addon = require(alternativePath);
                } else {
                    throw new Error(`Native module not found at ${unpackedPath} or ${alternativePath}`);
                }
            }
        }
    } catch (err2) {
        // 最后尝试直接加载
        try {
            addon = require('./build/Release/disable_winkey.node');
        } catch (err3) {
            console.error('Failed to load native addon:', err3.message);
            // 不抛出错误，而是返回一个模拟对象，避免应用崩溃
            addon = {
                enableAll: () => {
                    console.warn('Native module not available, enableAll is a no-op');
                    return true;
                },
                disableAll: () => {
                    console.warn('Native module not available, disableAll is a no-op');
                    return true;
                }
            };
        }
    }
}

/**
 * A manager for handling keyboard key state.
 */
class KeyManager {
    constructor() {
        // State is managed internally by the native addon.
    }
    /**
     * Enables all functionalities.
     */
    enableAll() {
        return addon.enableAll();
    }

    /**
     * Disables all functionalities.
     */
    disableAll() {
        return addon.disableAll();
    }
}

const keyManager = new KeyManager();

// To solve the `this` context issue cleanly, we export functions
// that are guaranteed to call the methods on the single instance.
module.exports = {
    KeyManager,
    enableAll: () => keyManager.enableAll(),
    disableAll: () => keyManager.disableAll(),
};