@echo off
rem Копия папки data (база + архивы) в папку backups\ДАТА. Можно поставить в Планировщик заданий Windows.
cd /d "%~dp0"
set D=%date:~-4%-%date:~3,2%-%date:~0,2%
mkdir "backups\%D%" 2>nul
xcopy /E /I /Y data "backups\%D%\data" >nul && echo Копия сохранена в backups\%D%
