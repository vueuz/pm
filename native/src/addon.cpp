#include <napi.h>

#ifdef _WIN32
#include <windows.h>

static HHOOK g_hHook = NULL;
static bool g_isBlocking = false;

// 需要拦截的虚拟键码
#define VK_LWIN 0x5B
#define VK_RWIN 0x5C
#define VK_TAB 0x09
#define VK_ESCAPE 0x1B
#define VK_F4 0x73

// 低级键盘钩子回调
LRESULT CALLBACK LowLevelKeyboardProc(int nCode, WPARAM wParam, LPARAM lParam) {
    if (nCode == HC_ACTION && g_isBlocking) {
        KBDLLHOOKSTRUCT* pKbdStruct = (KBDLLHOOKSTRUCT*)lParam;
        DWORD vkCode = pKbdStruct->vkCode;

        // 检测 Alt、Ctrl、Win 修饰键状态
        bool altPressed = (GetAsyncKeyState(VK_MENU) & 0x8000) != 0;
        bool ctrlPressed = (GetAsyncKeyState(VK_CONTROL) & 0x8000) != 0;
        bool winPressed = (GetAsyncKeyState(VK_LWIN) & 0x8000) != 0 || 
                          (GetAsyncKeyState(VK_RWIN) & 0x8000) != 0;

        // 拦截规则
        bool shouldBlock = false;

        // 1. 拦截所有 Win 键组合
        if (vkCode == VK_LWIN || vkCode == VK_RWIN || winPressed) {
            shouldBlock = true;
        }
        // 2. 拦截 Alt+Tab（任务切换）
        else if (altPressed && vkCode == VK_TAB) {
            shouldBlock = true;
        }
        // 3. 拦截 Alt+F4（关闭窗口）
        else if (altPressed && vkCode == VK_F4) {
            shouldBlock = true;
        }
        // 4. 拦截 Ctrl+Esc（开始菜单）
        else if (ctrlPressed && vkCode == VK_ESCAPE) {
            shouldBlock = true;
        }
        // 5. 拦截 Alt+Esc（循环切换窗口）
        else if (altPressed && vkCode == VK_ESCAPE) {
            shouldBlock = true;
        }
        // 6. 拦截 Ctrl+Shift+Esc（任务管理器）
        else if (ctrlPressed && (GetAsyncKeyState(VK_SHIFT) & 0x8000) && vkCode == VK_ESCAPE) {
            shouldBlock = true;
        }

        if (shouldBlock) {
            return 1; // 非零返回值阻止按键传递
        }
    }
    return CallNextHookEx(g_hHook, nCode, wParam, lParam);
}

// 启动钩子
Napi::Value Start(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (g_hHook != NULL) {
        return Napi::Boolean::New(env, true); // 已经启动
    }

    g_isBlocking = true;
    g_hHook = SetWindowsHookEx(WH_KEYBOARD_LL, LowLevelKeyboardProc, GetModuleHandle(NULL), 0);

    if (g_hHook == NULL) {
        Napi::Error::New(env, "Failed to set keyboard hook. Administrator privileges may be required.")
            .ThrowAsJavaScriptException();
        return Napi::Boolean::New(env, false);
    }

    return Napi::Boolean::New(env, true);
}

// 停止钩子
Napi::Value Stop(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (g_hHook != NULL) {
        UnhookWindowsHookEx(g_hHook);
        g_hHook = NULL;
    }
    g_isBlocking = false;

    return Napi::Boolean::New(env, true);
}

// 检查状态
Napi::Value IsActive(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    return Napi::Boolean::New(env, g_hHook != NULL && g_isBlocking);
}

// 模块初始化
Napi::Object Init(Napi::Env env, Napi::Object exports) {
    exports.Set(Napi::String::New(env, "start"), Napi::Function::New(env, Start));
    exports.Set(Napi::String::New(env, "stop"), Napi::Function::New(env, Stop));
    exports.Set(Napi::String::New(env, "isActive"), Napi::Function::New(env, IsActive));
    return exports;
}

NODE_API_MODULE(hotkey_blocker, Init)

#else
// 非 Windows 平台占位符
Napi::Value Start(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    return Napi::Boolean::New(env, false);
}

Napi::Value Stop(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    return Napi::Boolean::New(env, true);
}

Napi::Value IsActive(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    return Napi::Boolean::New(env, false);
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
    exports.Set(Napi::String::New(env, "start"), Napi::Function::New(env, Start));
    exports.Set(Napi::String::New(env, "stop"), Napi::Function::New(env, Stop));
    exports.Set(Napi::String::New(env, "isActive"), Napi::Function::New(env, IsActive));
    return exports;
}

NODE_API_MODULE(hotkey_blocker, Init)
#endif