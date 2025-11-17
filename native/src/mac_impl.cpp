#include "platform.h"
#include <ApplicationServices/ApplicationServices.h>
#include <CoreFoundation/CoreFoundation.h>
#include <Carbon/Carbon.h> // 添加这行来包含虚拟键码定义
#include <iostream>

// macOS-specific global variables
CFMachPortRef g_eventTap = NULL;
CFRunLoopSourceRef g_runLoopSource = NULL;
CFRunLoopRef g_runLoop = NULL;
pthread_t g_thread;

// macOS event tap callback
CGEventRef EventTapCallback(CGEventTapProxy proxy, CGEventType type, CGEventRef event, void *refcon)
{
    if (type == kCGEventKeyDown || type == kCGEventKeyUp || type == kCGEventFlagsChanged)
    {
        CGEventFlags flags = CGEventGetFlags(event);
        CGKeyCode keyCode = (CGKeyCode)CGEventGetIntegerValueField(event, kCGKeyboardEventKeycode);

        std::cout << "keyCode: " << keyCode << std::endl;

        if((flags & kCGEventFlagMaskAlternate) && keyCode == 103){
            std::cout << "isFnKeyDisabled: " << keyCode << std::endl;
            return NULL;
        }

        if (g_isWinKeyDisabled && (flags & kCGEventFlagMaskCommand) && (keyCode == 55 || keyCode == 54 || keyCode == 103))
        {
            return NULL;
        }

        if (g_isAltTabDisabled && (flags & kCGEventFlagMaskCommand) && keyCode == kVK_Tab)
        {
            return NULL;
        }

        if (g_isAltKeyDisabled && (flags & kCGEventFlagMaskAlternate))
        {
            return NULL;
        }

        // F11键的拦截处理
        if (g_isF11KeyDisabled && keyCode == kVK_F11)
        {
            return NULL;
        }

        // 移除对Ctrl键的拦截
        // if (g_isCtrlKeyDisabled && (flags & kCGEventFlagMaskControl))
        // {
        //     return NULL;
        // }

        // F3键的全面拦截处理
        if (g_isF3KeyDisabled)
        {
            // 调试输出：显示键码和标志（仅在开发时使用）
            #ifdef DEBUG
            std::cout << "Key pressed: keyCode=" << keyCode << ", flags=" << flags << std::endl;
            #endif
            
            // 直接按F3键
            if (keyCode == kVK_F3)
            {
                return NULL;
            }
            
            // 拦截Mission Control相关的键码（Fn+F3可能触发的功能）
            // 在macOS中，Fn+F3通常会触发Mission Control，其键码可能不同
            if (keyCode == 160 || keyCode == 131 || keyCode == 179) // 常见的Mission Control键码
            {
                return NULL;
            }
            
            // 额外的F3相关功能键拦截（根据不同macOS版本可能不同）
            if (keyCode == 130) // 一些系统中的F3功能键码
            {
                return NULL;
            }
        }
        
        // 禁用所有F1到F12功能键
        if (g_isFunctionKeysDisabled && (keyCode == kVK_F1 || keyCode == kVK_F2 || keyCode == kVK_F3 || keyCode == kVK_F4 || keyCode == kVK_F5 || keyCode == kVK_F6 || keyCode == kVK_F7 || keyCode == kVK_F8 || keyCode == kVK_F9 || keyCode == kVK_F10 || keyCode == kVK_F11 || keyCode == kVK_F12))
        {
            std::cout << "F1-F12: " << keyCode << std::endl;
            return NULL;
        }
        
        // FN键的拦截处理
        if (g_isFnKeyDisabled)
        {
            // 在macOS中，Fn键的键码通常为63（0x3F）
            if (keyCode == 63)
            {
                return NULL;
            }
            
            // 检测Fn组合键 - 在macOS中，Fn键通常会改变其他键的行为
            // 当按下Fn+功能键时，系统会发送特殊的键码
            
            // 拦截所有Fn+F1到F12的组合键
            // 明确列出所有功能键，避免范围比较警告
            if (keyCode == kVK_F1 || keyCode == kVK_F2 || keyCode == kVK_F3 || 
                keyCode == kVK_F4 || keyCode == kVK_F5 || keyCode == kVK_F6 ||
                keyCode == kVK_F7 || keyCode == kVK_F8 || keyCode == kVK_F9 ||
                keyCode == kVK_F10 || keyCode == kVK_F11 || keyCode == kVK_F12)
            {
                if (flags & 0x800000) // 这个标志位通常表示Fn修饰键
                {
                    return NULL;
                }
            }
            
            // 拦截可能的Fn特殊功能键码f1 - f6
            if (keyCode == 145 || keyCode==160 || keyCode==144|| keyCode==131|| keyCode==96 || keyCode==97 || keyCode==177 || keyCode==176|| keyCode==178) // 一些常见的特殊功能键码范围
            {
                return NULL;
            }
        }
    }
    return event;
}

// Thread function to run the macOS event loop
void *RunLoopThread(void *arg)
{
    g_runLoop = CFRunLoopGetCurrent();

    g_eventTap = CGEventTapCreate(kCGSessionEventTap, kCGHeadInsertEventTap, kCGEventTapOptionDefault, kCGEventMaskForAllEvents, EventTapCallback, NULL);
    if (!g_eventTap)
    {
        std::cerr << "Failed to create event tap" << std::endl;
        return NULL;
    }

    g_runLoopSource = CFMachPortCreateRunLoopSource(kCFAllocatorDefault, g_eventTap, 0);
    CFRunLoopAddSource(g_runLoop, g_runLoopSource, kCFRunLoopCommonModes);
    CGEventTapEnable(g_eventTap, true);

    CFRunLoopRun();

    CGEventTapEnable(g_eventTap, false);
    if (g_runLoopSource)
        CFRelease(g_runLoopSource);
    if (g_eventTap)
        CFRelease(g_eventTap);
    g_runLoop = NULL;
    g_eventTap = NULL;
    g_runLoopSource = NULL;

    return NULL;
}

void EnsureHookThreadRunning(Napi::Env env)
{
    if (!g_runLoop)
    {
        if (pthread_create(&g_thread, NULL, RunLoopThread, NULL) != 0)
        {
            Napi::TypeError::New(env, "Failed to create thread").ThrowAsJavaScriptException();
            return;
        }
        sleep(1);
        if (!g_eventTap)
        {
            Napi::TypeError::New(env, "Failed to install keyboard hook").ThrowAsJavaScriptException();
        }
    }
}

void StopHookThreadIfNeeded()
{
    // 更新条件判断，移除对 g_isCtrlKeyDisabled 的检查
    if (g_runLoop && !g_isWinKeyDisabled && !g_isAltTabDisabled && !g_isAltKeyDisabled && !g_isF11KeyDisabled && !g_isF3KeyDisabled && !g_isFnKeyDisabled && !g_isFunctionKeysDisabled)
    {
        CFRunLoopStop(g_runLoop);
        pthread_join(g_thread, NULL);
    }
}

void PlatformInit(Napi::Env env, Napi::Object exports)
{
    // No-op for macOS
}