@echo off
title BorderVision AI Launcher
echo ===================================================
echo  BorderVision AI — Starting Frontend ^& Backend
echo ===================================================
echo.

:: Launch Backend Server (Python FastAPI on port 8000)
start "BorderVision AI - Backend (Port 8000)" cmd /k "cd /d %~dp0backend && python -m uvicorn main:app --reload --port 8000"

:: Launch Frontend Server (Vite React on port 3000)
start "BorderVision AI - Frontend (Port 3000)" cmd /k "cd /d %~dp0 && npm run dev"

echo [SUCCESS] Both servers launched in background windows!
echo  - Frontend UI: http://localhost:3000
echo  - Backend API: http://localhost:8000
echo.
