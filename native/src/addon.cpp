#include "platform.h"

// Define global state variables - default all keys are disabled
bool g_isWinKeyDisabled = true;
bool g_isAltTabDisabled = true;
bool g_isAltKeyDisabled = true;
bool g_isF11KeyDisabled = true;
// 移除 g_isCtrlKeyDisabled 的初始化
bool g_isF3KeyDisabled = true;
bool g_isFnKeyDisabled = true;
bool g_isFunctionKeysDisabled = true; // 禁用所有F1到F12功能键

// Function to disable all keys
Napi::Value disableAll(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    g_isWinKeyDisabled = true;
    g_isAltTabDisabled = true;
    g_isAltKeyDisabled = true;
    g_isF3KeyDisabled = true;
    // 移除 g_isCtrlKeyDisabled 的设置
    g_isF11KeyDisabled = true;
    g_isFnKeyDisabled = true;
    g_isFunctionKeysDisabled = true;
    EnsureHookThreadRunning(env);
    // 键已经默认禁用，无需再次设置
    return Napi::Boolean::New(env, true);
}

// Function to enable all keys
Napi::Value enableAll(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    g_isWinKeyDisabled = false;
    g_isAltTabDisabled = false;
    g_isAltKeyDisabled = false;
    g_isF3KeyDisabled = false;
    // 移除 g_isCtrlKeyDisabled 的设置
    g_isF11KeyDisabled = false;
    g_isFnKeyDisabled = false;
    g_isFunctionKeysDisabled = false;
    StopHookThreadIfNeeded();
    return Napi::Boolean::New(env, true);
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
    PlatformInit(env, exports);

    exports.Set("disableAll", Napi::Function::New(env, disableAll));
    exports.Set("enableAll", Napi::Function::New(env, enableAll));
    return exports;
}

NODE_API_MODULE(disable_winkey, Init)