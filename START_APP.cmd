@echo off
setlocal
cd /d "%~dp0"

if /I "%~1"=="--check" (
  echo launcher=ready
  exit /b 0
)

where node >nul 2>&1
if errorlevel 1 (
  echo.
  echo ERROR: Node.js is not installed or is not available in PATH.
  echo Install Node.js LTS from https://nodejs.org/ and try again.
  echo.
  pause
  exit /b 1
)

where npm >nul 2>&1
if errorlevel 1 (
  echo.
  echo ERROR: npm is not available in PATH.
  echo Reinstall Node.js LTS and try again.
  echo.
  pause
  exit /b 1
)

if not exist "node_modules\electron\package.json" (
  echo Installing Electron for the first time...
  call npm install --no-audit --no-fund
  if errorlevel 1 (
    echo.
    echo ERROR: dependencies could not be installed.
    pause
    exit /b 1
  )
)

echo Starting Synapse Labs Trading Bot Desktop...
powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -Command "Start-Process -FilePath '%~dp0node_modules\electron\dist\electron.exe' -ArgumentList '.' -WorkingDirectory '%~dp0' -WindowStyle Normal"

rem The launcher has completed its task; Electron continues running separately.
endlocal
exit /b 0
