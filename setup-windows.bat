@echo off
echo ========================================
echo Windows Native Module Setup
echo ========================================
echo.

echo [1/4] Installing project dependencies...
call npm install
if %errorlevel% neq 0 (
    echo ERROR: Failed to install project dependencies
    pause
    exit /b 1
)
echo.

echo [2/4] Navigating to native module directory...
cd native
if %errorlevel% neq 0 (
    echo ERROR: Native directory not found
    pause
    exit /b 1
)
echo.

echo [3/4] Installing native module dependencies...
call npm install
if %errorlevel% neq 0 (
    echo ERROR: Failed to install native module dependencies
    cd ..
    pause
    exit /b 1
)
echo.

echo [4/4] Building native module for Windows...
call npm run build
if %errorlevel% neq 0 (
    echo ERROR: Failed to build native module
    echo.
    echo Please make sure you have:
    echo - Visual Studio Build Tools installed
    echo - Windows SDK installed
    echo - Python installed
    cd ..
    pause
    exit /b 1
)
echo.

cd ..

echo ========================================
echo Setup completed successfully!
echo ========================================
echo.
echo You can now run the application with: npm start
echo.
pause
