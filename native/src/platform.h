#ifndef PLATFORM_H
#define PLATFORM_H

#include <napi.h>

// Declarations for platform-specific functions that must be implemented
// in win_impl.cpp and mac_impl.cpp.
void EnsureHookThreadRunning(Napi::Env env);
void StopHookThreadIfNeeded();
void PlatformInit(Napi::Env env, Napi::Object exports);

// Declarations for global state variables defined in addon.cpp
extern bool g_isWinKeyDisabled;
extern bool g_isAltTabDisabled;
extern bool g_isAltKeyDisabled;
extern bool g_isF11KeyDisabled;
extern bool g_isCtrlKeyDisabled;
extern bool g_isF3KeyDisabled;
extern bool g_isFnKeyDisabled;
extern bool g_isFunctionKeysDisabled;

#endif // PLATFORM_H
