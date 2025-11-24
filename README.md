# Astro Starter Kit: Minimal

```sh
npm create astro@latest -- --template minimal
```

> 🧑‍🚀 **Seasoned astronaut?** Delete this file. Have fun!

## 🚀 Project Structure

Inside of your Astro project, you'll see the following folders and files:

```text
/
├── public/
├── src/
│   └── pages/
│       └── index.astro
└── package.json
```

Astro looks for `.astro` or `.md` files in the `src/pages/` directory. Each page is exposed as a route based on its file name.

There's nothing special about `src/components/`, but that's where we like to put any Astro/React/Vue/Svelte/Preact components.

Any static assets, like images, can be placed in the `public/` directory.

## 🧞 Commands

All commands are run from the root of the project, from a terminal:

| Command                   | Action                                           |
| :------------------------ | :----------------------------------------------- |
| `npm install`             | Installs dependencies                            |
| `npm run dev`             | Starts local dev server at `localhost:4321`      |
| `npm run build`           | Build your production site to `./dist/`          |
| `npm run preview`         | Preview your build locally, before deploying     |
| `npm run astro ...`       | Run CLI commands like `astro add`, `astro check` |
| `npm run astro -- --help` | Get help using the Astro CLI                     |

## 👀 Want to learn more?

Feel free to check [our documentation](https://docs.astro.build) or jump into our [Discord server](https://astro.build/chat).


# Activity Tracker

A minimal Windows activity tracker that runs as a background process.

## Features

- **Window Tracking**: Tracks active application name and window title
- **Input Metrics**: Counts keyboard presses, mouse clicks, and mouse movement distance
- **Idle Detection**: Detects when user is idle (no input for 3+ minutes)
- **SQLite Database**: Stores all data locally in structured tables
- **60-Second Aggregation**: Logs data every minute
- **Production-Ready**: Graceful shutdown, error handling, runs 24/7

## Installation

```bash
# Install dependencies
pip install -r requirements.txt
```

## Usage

```bash
# Run the tracker
python run_tracker.py
```

Press `Ctrl+C` to stop the tracker gracefully.

## Database Location

By default, the database is stored at:
```
C:\Users\<username>\AppData\Local\activity-tracker\tracker.db
```

## Database Schema

### activity_log
- `id`: Primary key
- `timestamp`: ISO timestamp when activity started
- `app_name`: Application executable name (e.g., "chrome.exe")
- `window_title`: Window title text
- `duration`: Duration in seconds
- `created_at`: Record creation timestamp

### input_metrics
- `id`: Primary key
- `timestamp`: ISO timestamp
- `key_presses`: Number of keyboard presses in period
- `mouse_clicks`: Number of mouse clicks in period
- `mouse_distance`: Mouse movement distance in pixels
- `created_at`: Record creation timestamp

### idle_periods
- `id`: Primary key
- `start_time`: ISO timestamp when idle started
- `end_time`: ISO timestamp when user became active
- `duration`: Idle duration in seconds
- `created_at`: Record creation timestamp

## Architecture

- **database.py**: SQLite schema and database operations
- **window_tracker.py**: Windows API integration for active window tracking
- **input_tracker.py**: pynput integration for keyboard/mouse tracking
- **activity_tracker.py**: Main daemon that orchestrates everything
- **run_tracker.py**: Simple runner script

## Running as Windows Service (Optional)

To run 24/7 as a background service, consider using:
- NSSM (Non-Sucking Service Manager)
- Task Scheduler with "Run at startup"
- pythonw.exe to run without console window

## Privacy

- No keylogging - only counts key presses
- All data stored locally
- No network requests
- Open source - verify the code yourself

# Activity Tracker - Setup Guide

## Quick Start

The tracker is now consolidated into a **single file** (`activity_tracker.py`) that's easy to copy and deploy.

## Prerequisites

1. **Python 3.7+** installed on Windows
   - Download from: https://www.python.org/downloads/
   - Make sure to check "Add Python to PATH" during installation

2. **Install dependencies** (one-time setup):
   ```bash
   pip install pywin32 psutil pynput inputs
   ```

   Dependencies:
   - `pywin32` - Windows API for window tracking
   - `psutil` - Process information
   - `pynput` - Keyboard and mouse monitoring
   - `inputs` - Xbox/game controller tracking (prevents idle during gaming)

## Files

- `activity_tracker.py` - The main tracker script (single file, ~500 lines)
- `start_tracker.bat` - Windows batch file to run tracker hidden in background
- `SETUP.md` - This file

## Running the Tracker

### Method 1: Manual Start (for testing)

Run directly with Python (shows console output):
```bash
python activity_tracker.py
```

Press `Ctrl+C` to stop.

### Method 2: Hidden Background Start (recommended)

Double-click `start_tracker.bat` or run:
```bash
start_tracker.bat
```

This runs the tracker hidden without a console window.

## Autostart on Windows Login

Choose one of the following methods:

### Option A: Task Scheduler (Recommended)

Most reliable method with full control:

1. **Open Task Scheduler**
   - Press `Win + R`, type `taskschd.msc`, press Enter

2. **Create Basic Task**
   - Click "Create Basic Task" in the right panel
   - Name: `Activity Tracker`
   - Description: `Start activity tracker on login`

3. **Trigger**
   - Select "When I log on"
   - Click Next

4. **Action**
   - Select "Start a program"
   - Click Next

5. **Program/Script Settings**
   - Program/script: `C:\Users\thoma\code\tracker\start_tracker.bat`
   - (Replace with your actual path)
   - Click Next, then Finish

6. **Additional Settings** (optional but recommended)
   - Right-click the task → Properties
   - Under "General" tab:
     - Check "Run whether user is logged on or not" (if you want it always running)
     - Check "Hidden" (won't show in Task Manager's Apps list)
   - Under "Conditions" tab:
     - Uncheck "Start the task only if the computer is on AC power"
   - Under "Settings" tab:
     - Check "If the task is already running, do not start a new instance"

**To test:** Right-click the task → Run

**To disable:** Right-click the task → Disable

### Option B: Startup Folder (Simpler)

Easier but less configurable:

1. **Open Startup Folder**
   - Press `Win + R`
   - Type: `shell:startup`
   - Press Enter

2. **Create Shortcut**
   - Right-click in the Startup folder → New → Shortcut
   - Location: `C:\Users\thoma\code\tracker\start_tracker.bat`
   - (Replace with your actual path)
   - Name it "Activity Tracker"

**Note:** The shortcut will run on login, but may briefly show a window.

## Managing the Tracker

### Check if it's running

Open Task Manager (`Ctrl + Shift + Esc`):
- Look for `pythonw.exe` in the "Details" tab
- Command line should show `activity_tracker.py`

### Stop the tracker

**If started with `start_tracker.bat`:**
1. Open Task Manager
2. Find `pythonw.exe` running `activity_tracker.py`
3. Right-click → End Task

**If running in console:**
- Press `Ctrl + C`

### View the database

Data is stored in: `%USERPROFILE%\Documents\activity-tracker\tracker.db`

Full path: `C:\Users\thoma\Documents\activity-tracker\tracker.db`

You can query it with any SQLite browser:
- DB Browser for SQLite: https://sqlitebrowser.org/
- Or use Python: `sqlite3 tracker.db`

### Tables

- `activity_log` - Window activity records (app_name, window_title, duration)
- `input_metrics` - Keyboard/mouse metrics per minute
- `idle_periods` - Idle session tracking (>3 minutes of no activity)

## Troubleshooting

### "pip install" fails
- Make sure Python is in your PATH
- Try: `python -m pip install pywin32 psutil pynput`

### Tracker doesn't start
- Test manually first: `python activity_tracker.py`
- Check for error messages
- Verify all dependencies are installed: `pip list | findstr "pywin32 psutil pynput"`

### Autostart doesn't work
- **Task Scheduler:** Open Task Scheduler, check "Last Run Result" for errors
- **Startup folder:** Check the shortcut path is correct
- Make sure the batch file path uses absolute paths (not relative)

### Multiple instances running
- Check Task Manager for multiple `pythonw.exe` processes
- End all, then restart
- For Task Scheduler: Enable "If the task is already running, do not start a new instance"

### Database permission errors
- The default location is `Documents\activity-tracker\`
- If you get errors, try running as administrator once to create the folder
- Or specify a custom path in the script

## Customization

Edit `activity_tracker.py` to change:

- `POLL_INTERVAL = 1` - How often to check active window (seconds)
- `LOG_INTERVAL = 60` - How often to log metrics (seconds)
- `IDLE_THRESHOLD = 180` - Idle timeout (seconds, default 3 minutes)
- Database path: Change in `Database.__init__()` method

## Uninstall

1. Stop the tracker (see "Managing the Tracker")
2. Remove from autostart:
   - **Task Scheduler:** Delete the task
   - **Startup folder:** Delete the shortcut
3. Delete the tracker files
4. Optional: Delete the database folder: `%USERPROFILE%\Documents\activity-tracker\`

## Privacy Note

All data is stored **locally** on your machine in a SQLite database. Nothing is sent over the network. The tracker only monitors:
- Active window titles and application names
- Keyboard presses (count only, not what you type)
- Mouse clicks and movement distance
- Idle periods

You have full control over the data and can delete it at any time.