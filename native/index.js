const bindings = require('bindings');

const addon = bindings('disable_winkey');

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
