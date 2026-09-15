@echo off
echo ============================================
echo  BorderVision AI - Backend Server
echo ============================================
echo.

:: Check Python
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python not found. Install Python 3.9+ and add to PATH.
    pause
    exit /b 1
)

:: Install dependencies if needed
if not exist ".deps_installed" (
    echo [Setup] Installing Python dependencies...
    pip install -r requirements.txt
    echo. > .deps_installed
)

echo [Start] Launching FastAPI on http://localhost:8000
echo [Start] Press Ctrl+C to stop
echo.

python -m uvicorn main:app --reload --port 8000 --host 0.0.0.0

pause
