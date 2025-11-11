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
            addon = require(unpackedPath);
        }
    } catch (err2) {
        // 最后尝试直接加载
        try {
            addon = require('./build/Release/disable_winkey.node');
        } catch (err3) {
            console.error('Failed to load native addon:', err3.message);
            throw new Error('Cannot load native addon: ' + err3.message);
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
