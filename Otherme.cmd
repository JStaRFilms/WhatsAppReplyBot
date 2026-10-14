@echo off
setlocal
title Otherme - JStar Studios
pushd "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Otherme needs this PC's Node.js 24 installation. Nothing was started.
  pause
  popd
  exit /b 1
)
node scripts\start-otherme.mjs
if errorlevel 1 (
  echo.
  echo Otherme could not start. Read the message above. No existing service was stopped.
  pause
)
popd
endlocal
