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
