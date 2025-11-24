@echo off
REM Activity Tracker Launcher - Runs Python script hidden in background
REM This script also sets up auto-start on Windows boot

REM Get the directory where this batch file is located
set SCRIPT_DIR=%~dp0

REM Create a shortcut in the Windows Startup folder for auto-start
set STARTUP_FOLDER=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup
set SHORTCUT_PATH=%STARTUP_FOLDER%\ActivityTracker.lnk

REM Check if shortcut already exists
if not exist "%SHORTCUT_PATH%" (
    echo Setting up auto-start on Windows boot...
    powershell -Command "$WS = New-Object -ComObject WScript.Shell; $SC = $WS.CreateShortcut('%SHORTCUT_PATH%'); $SC.TargetPath = '%~f0'; $SC.WorkingDirectory = '%SCRIPT_DIR%'; $SC.WindowStyle = 7; $SC.Description = 'Activity Tracker Auto-Start'; $SC.Save()"
    echo Auto-start configured successfully!
) else (
    echo Auto-start already configured.
)

REM Run Python script hidden using pythonw.exe (no console window)
REM pythonw.exe is included with standard Python installations
start "" /B pythonw.exe "%SCRIPT_DIR%tracker.py"

echo Activity tracker started in background.
