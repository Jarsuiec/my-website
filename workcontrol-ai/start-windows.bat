@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul || (echo Установите Node.js 22 LTS с https://nodejs.org и запустите снова. & pause & exit /b 1)
if not exist node_modules (
  echo Устанавливаю зависимости...
  call npm ci || (pause & exit /b 1)
)
if not exist .env copy .env.example .env >nul
if not exist .next\BUILD_ID (
  echo Собираю приложение...
  call npm run build || (pause & exit /b 1)
)
start "" http://127.0.0.1:3000
call npm start
pause
