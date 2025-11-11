#include "platform.h"
#include <windows.h>

// Windows-specific global variables
HHOOK g_hHook = NULL;
HANDLE g_hThread = NULL;
DWORD g_dwThreadId = 0;
HINSTANCE g_hModule = NULL;

// Windows low-level keyboard hook callback
LRESULT CALLBACK LowLevelKeyboardProc(int nCode, WPARAM wParam, LPARAM lParam) {
    if (nCode == HC_ACTION) {
        KBDLLHOOKSTRUCT *p = (KBDLLHOOKSTRUCT *)lParam;
        if (g_isWinKeyDisabled && (p->vkCode == VK_LWIN || p->vkCode == VK_RWIN)) {
            return 1;
        }
        if (g_isAltTabDisabled && p->vkCode == VK_TAB && (GetKeyState(VK_MENU) & 0x8000)) {
            return 1;
        }
        if (g_isAltKeyDisabled && (p->vkCode == VK_LMENU || p->vkCode == VK_RMENU)) {
            return 1;
        }
        if (g_isF11KeyDisabled && p->vkCode == VK_F11) {
            return 1;
        }
        if (g_isCtrlKeyDisabled && (p->vkCode == VK_LCONTROL || p->vkCode == VK_RCONTROL)) {
            return 1;
        }
        if (g_isF3KeyDisabled && p->vkCode == VK_F3) {
            return 1;
        }
        
        // 禁用所有F1到F12功能键
        if (g_isFunctionKeysDisabled && p->vkCode >= VK_F1 && p->vkCode <= VK_F12) {
            return 1;
        }
        // 检测FN键 - Windows中通常FN键是由硬件处理的，但我们可以尝试拦截一些特殊的扫描码
        if (g_isFnKeyDisabled) {
            // FN键通常不会直接发送到操作系统，但我们可以检测特殊的扫描码
            // 许多笔记本电脑的FN键扫描码为0x73或0xE0
            if (p->scanCode == 0x73 || p->scanCode == 0xE0) {
                return 1;
            }
            
            // 一些笔记本电脑使用不同的扫描码，如果上面的不起作用，可以添加更多的扫描码
            
            // 禁用所有FN+F1到F12的组合键
            // 在Windows中，Fn+F键通常会产生特殊的扫描码或标志
            if (p->vkCode >= VK_F1 && p->vkCode <= VK_F12) {
                // 检查是否有扩展键标志(0x01)或有上下文码标志(0x10)，这些通常表示Fn组合
                if (p->flags & (0x01 | 0x10)) {
                    return 1;
                }
                
                // 一些笔记本电脑可能使用不同的标志或扫描码
                // 通过检查扫描码的高位来识别可能的Fn组合
                if (p->scanCode > 0x80) {
                    return 1;
                }
            }
        }
    }
    return CallNextHookEx(g_hHook, nCode, wParam, lParam);
}

// Windows hook thread function
DWORD WINAPI HookThreadProc(LPVOID lpParameter) {
    g_hHook = SetWindowsHookEx(WH_KEYBOARD_LL, LowLevelKeyboardProc, g_hModule, 0);
    if (g_hHook == NULL) return 1;

    MSG msg;
    while (GetMessage(&msg, NULL, 0, 0)) {
        TranslateMessage(&msg);
        DispatchMessage(&msg);
    }

    if (g_hHook) {
        UnhookWindowsHookEx(g_hHook);
        g_hHook = NULL;
    }
    return 0;
}

void EnsureHookThreadRunning(Napi::Env env) {
    if (g_hThread == NULL) {
        g_hThread = CreateThread(NULL, 0, HookThreadProc, NULL, 0, &g_dwThreadId);
        if (g_hThread == NULL) {
            Napi::TypeError::New(env, "Failed to create hook thread").ThrowAsJavaScriptException();
            return;
        }
        Sleep(100);
        if (g_hHook == NULL) {
            Napi::TypeError::New(env, "Failed to install keyboard hook").ThrowAsJavaScriptException();
        }
    }
}

void StopHookThreadIfNeeded() {
    if (g_hThread != NULL && !g_isWinKeyDisabled && !g_isAltTabDisabled && !g_isAltKeyDisabled && !g_isF11KeyDisabled && !g_isCtrlKeyDisabled && !g_isF3KeyDisabled && !g_isFnKeyDisabled && !g_isFunctionKeysDisabled) {
        PostThreadMessage(g_dwThreadId, WM_QUIT, 0, 0);
        WaitForSingleObject(g_hThread, 1000);
        CloseHandle(g_hThread);
        g_hThread = NULL;
        g_dwThreadId = 0;
        g_hHook = NULL;
    }
}

void PlatformInit(Napi::Env env, Napi::Object exports) {
    MEMORY_BASIC_INFORMATION mbi;
    VirtualQuery((LPCVOID)PlatformInit, &mbi, sizeof(mbi));
    g_hModule = (HINSTANCE)mbi.AllocationBase;
}
