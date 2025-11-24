"""
Activity Tracker - Single-file Windows activity monitoring tool
Tracks active windows, keyboard/mouse input, controller input, and idle periods.
Database stored in: %USERPROFILE%\Documents\activity-tracker\tracker.db

Requirements: pip install pywin32 psutil pynput inputs
"""
import sqlite3
import time
import signal
import sys
import threading
from pathlib import Path
from datetime import datetime, timedelta
from typing import Optional, Tuple
from dataclasses import dataclass

# Windows API imports
import win32gui
import win32process
import psutil

# Input tracking imports
from pynput import keyboard, mouse

# Controller tracking imports
try:
    from inputs import get_gamepad
    CONTROLLER_AVAILABLE = True
except ImportError:
    CONTROLLER_AVAILABLE = False


# ============================================================================
# DATABASE
# ============================================================================

class Database:
    """Manages SQLite database for activity tracking."""

    def __init__(self, db_path: Optional[str] = None):
        """Initialize database connection.

        Args:
            db_path: Path to SQLite database file. Defaults to tracker.db in Documents folder.
        """
        if db_path is None:
            db_path = Path.home() / 'Documents' / 'activity-tracker' / 'tracker.db'

        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self.conn = None
        self._initialize()

    def _initialize(self):
        """Create database connection and tables if they don't exist."""
        self.conn = sqlite3.connect(self.db_path, check_same_thread=False)
        self.conn.row_factory = sqlite3.Row

        self.conn.executescript("""
            CREATE TABLE IF NOT EXISTS activity_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
                app_name TEXT NOT NULL,
                window_title TEXT NOT NULL,
                duration INTEGER NOT NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS input_metrics (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
                key_presses INTEGER DEFAULT 0,
                mouse_clicks INTEGER DEFAULT 0,
                mouse_distance INTEGER DEFAULT 0,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS idle_periods (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                start_time TEXT NOT NULL,
                end_time TEXT,
                duration INTEGER,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            );

            CREATE INDEX IF NOT EXISTS idx_activity_timestamp ON activity_log(timestamp);
            CREATE INDEX IF NOT EXISTS idx_input_timestamp ON input_metrics(timestamp);
            CREATE INDEX IF NOT EXISTS idx_idle_start ON idle_periods(start_time);
        """)

        self.conn.commit()

    def log_activity(self, timestamp: str, app_name: str, window_title: str, duration: int):
        """Log active window activity.

        Args:
            timestamp: ISO format timestamp
            app_name: Application executable name
            window_title: Window title text
            duration: Duration in seconds
        """
        self.conn.execute(
            """INSERT INTO activity_log (timestamp, app_name, window_title, duration)
               VALUES (?, ?, ?, ?)""",
            (timestamp, app_name, window_title, duration)
        )
        self.conn.commit()

    def log_input_metrics(self, timestamp: str, key_presses: int, mouse_clicks: int, mouse_distance: int):
        """Log input metrics for a time period.

        Args:
            timestamp: ISO format timestamp
            key_presses: Number of keyboard presses
            mouse_clicks: Number of mouse clicks
            mouse_distance: Mouse movement distance in pixels
        """
        self.conn.execute(
            """INSERT INTO input_metrics (timestamp, key_presses, mouse_clicks, mouse_distance)
               VALUES (?, ?, ?, ?)""",
            (timestamp, key_presses, mouse_clicks, mouse_distance)
        )
        self.conn.commit()

    def start_idle_period(self, start_time: str) -> int:
        """Record start of idle period.

        Args:
            start_time: ISO format timestamp

        Returns:
            Row ID of the idle period
        """
        cursor = self.conn.execute(
            "INSERT INTO idle_periods (start_time) VALUES (?)",
            (start_time,)
        )
        self.conn.commit()
        return cursor.lastrowid

    def end_idle_period(self, idle_id: int, end_time: str, duration: int):
        """Record end of idle period.

        Args:
            idle_id: Row ID of the idle period
            end_time: ISO format timestamp
            duration: Duration in seconds
        """
        self.conn.execute(
            "UPDATE idle_periods SET end_time = ?, duration = ? WHERE id = ?",
            (end_time, duration, idle_id)
        )
        self.conn.commit()

    def close(self):
        """Close database connection."""
        if self.conn:
            self.conn.close()


# ============================================================================
# WINDOW TRACKER
# ============================================================================

@dataclass
class WindowInfo:
    """Information about the active window."""
    app_name: str
    window_title: str


class WindowTracker:
    """Tracks the currently active window on Windows."""

    def __init__(self):
        self._last_window: Optional[WindowInfo] = None

    def get_active_window(self) -> Optional[WindowInfo]:
        """Get information about the currently active window.

        Returns:
            WindowInfo object or None if unable to get window info
        """
        try:
            hwnd = win32gui.GetForegroundWindow()
            if not hwnd:
                return None

            # Get window title
            window_title = win32gui.GetWindowText(hwnd)
            if not window_title:
                return None

            # Get process ID
            _, pid = win32process.GetWindowThreadProcessId(hwnd)

            # Get process name
            try:
                process = psutil.Process(pid)
                app_name = process.name()
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                app_name = "Unknown"

            return WindowInfo(app_name=app_name, window_title=window_title)

        except Exception:
            # Silently fail - some windows may be inaccessible
            return None

    def has_window_changed(self, current: Optional[WindowInfo]) -> bool:
        """Check if the active window has changed.

        Args:
            current: Current window info

        Returns:
            True if window changed, False otherwise
        """
        if current is None and self._last_window is None:
            return False

        if current is None or self._last_window is None:
            return True

        changed = (
            current.app_name != self._last_window.app_name
            or current.window_title != self._last_window.window_title
        )

        return changed

    def update_last_window(self, window: Optional[WindowInfo]):
        """Update the last known window.

        Args:
            window: Window info to store
        """
        self._last_window = window


# ============================================================================
# INPUT TRACKER
# ============================================================================

class InputTracker:
    """Tracks keyboard and mouse input metrics."""

    def __init__(self):
        self._key_presses = 0
        self._mouse_clicks = 0
        self._mouse_distance = 0
        self._last_mouse_pos = None
        self._last_activity_time = time.time()
        self._lock = threading.Lock()

        # Listeners
        self._keyboard_listener = None
        self._mouse_listener = None
        self._controller_thread = None
        self._running = False

    def start(self):
        """Start tracking keyboard, mouse, and controller input."""
        self._running = True

        # Keyboard listener
        self._keyboard_listener = keyboard.Listener(
            on_press=self._on_key_press
        )
        self._keyboard_listener.start()

        # Mouse listener
        self._mouse_listener = mouse.Listener(
            on_move=self._on_mouse_move,
            on_click=self._on_mouse_click
        )
        self._mouse_listener.start()

        # Controller listener (if available)
        if CONTROLLER_AVAILABLE:
            self._controller_thread = threading.Thread(target=self._controller_loop, daemon=True)
            self._controller_thread.start()

    def stop(self):
        """Stop tracking input."""
        self._running = False
        if self._keyboard_listener:
            self._keyboard_listener.stop()
        if self._mouse_listener:
            self._mouse_listener.stop()
        if self._controller_thread:
            self._controller_thread.join(timeout=1)

    def _controller_loop(self):
        """Background thread to monitor controller input."""
        print("Controller tracking started")
        while self._running:
            try:
                events = get_gamepad()
                for event in events:
                    # Any controller event counts as activity
                    # event.code contains button/stick identifiers
                    # event.state contains the value (pressed/released/analog value)
                    if event.state != 0:  # Ignore button releases and neutral positions
                        with self._lock:
                            self._last_activity_time = time.time()
            except Exception:
                # No controller connected or other error - wait and retry
                time.sleep(1)

    def _on_key_press(self, key):
        """Handle keyboard press event."""
        with self._lock:
            self._key_presses += 1
            self._last_activity_time = time.time()

    def _on_mouse_move(self, x, y):
        """Handle mouse movement event."""
        with self._lock:
            if self._last_mouse_pos is not None:
                dx = x - self._last_mouse_pos[0]
                dy = y - self._last_mouse_pos[1]
                distance = int((dx ** 2 + dy ** 2) ** 0.5)
                self._mouse_distance += distance

            self._last_mouse_pos = (x, y)
            self._last_activity_time = time.time()

    def _on_mouse_click(self, x, y, button, pressed):
        """Handle mouse click event."""
        if pressed:
            with self._lock:
                self._mouse_clicks += 1
                self._last_activity_time = time.time()

    def get_metrics_and_reset(self) -> Tuple[int, int, int]:
        """Get current metrics and reset counters.

        Returns:
            Tuple of (key_presses, mouse_clicks, mouse_distance)
        """
        with self._lock:
            metrics = (self._key_presses, self._mouse_clicks, self._mouse_distance)
            self._key_presses = 0
            self._mouse_clicks = 0
            self._mouse_distance = 0
            return metrics

    def get_idle_seconds(self) -> float:
        """Get seconds since last input activity.

        Returns:
            Seconds since last keyboard or mouse activity
        """
        with self._lock:
            return time.time() - self._last_activity_time

    def reset_idle_timer(self):
        """Reset the idle timer to current time."""
        with self._lock:
            self._last_activity_time = time.time()


# ============================================================================
# ACTIVITY TRACKER
# ============================================================================

class ActivityTracker:
    """Main activity tracker daemon."""

    # Constants
    POLL_INTERVAL = 1  # Poll every second
    LOG_INTERVAL = 60  # Log every 60 seconds
    IDLE_THRESHOLD = 180  # 3 minutes in seconds

    def __init__(self, db_path: Optional[str] = None):
        """Initialize the activity tracker.

        Args:
            db_path: Optional path to SQLite database
        """
        self.db = Database(db_path)
        self.window_tracker = WindowTracker()
        self.input_tracker = InputTracker()

        # State tracking
        self._running = False
        self._current_window: Optional[WindowInfo] = None
        self._window_start_time: Optional[datetime] = None
        self._last_log_time: Optional[datetime] = None
        self._is_idle = False
        self._idle_period_id: Optional[int] = None
        self._idle_start_time: Optional[datetime] = None

        # Setup signal handlers for graceful shutdown
        signal.signal(signal.SIGINT, self._signal_handler)
        signal.signal(signal.SIGTERM, self._signal_handler)

    def _signal_handler(self, signum, frame):
        """Handle shutdown signals gracefully."""
        print(f"\nReceived signal {signum}, shutting down...")
        self.stop()

    def start(self):
        """Start the activity tracker daemon."""
        print("Starting activity tracker...")
        self._running = True
        self.input_tracker.start()

        # Initialize to the start of the current minute
        now = datetime.now()
        self._last_log_time = now.replace(second=0, microsecond=0)

        try:
            self._run_loop()
        except Exception as e:
            print(f"Fatal error: {e}")
            self.stop()
            raise

    def stop(self):
        """Stop the activity tracker daemon."""
        if not self._running:
            return

        print("Stopping activity tracker...")
        self._running = False

        # Log any remaining activity
        self._log_current_window()
        self._log_metrics()

        # Stop input tracking
        self.input_tracker.stop()

        # Close database
        self.db.close()
        print("Activity tracker stopped.")
        sys.exit(0)

    def _run_loop(self):
        """Main tracking loop."""
        while self._running:
            now = datetime.now()

            # Get current window
            current_window = self.window_tracker.get_active_window()

            # Check if window changed
            if self.window_tracker.has_window_changed(current_window):
                self._log_current_window()
                self._current_window = current_window
                self._window_start_time = now
                self.window_tracker.update_last_window(current_window)

            # Check idle state
            idle_seconds = self.input_tracker.get_idle_seconds()
            self._handle_idle_state(idle_seconds)

            # Check if we've reached the next minute boundary
            next_log_time = self._last_log_time + timedelta(seconds=self.LOG_INTERVAL)
            if now >= next_log_time:
                self._log_metrics()
                # Set to the exact minute boundary
                self._last_log_time = now.replace(second=0, microsecond=0)

            # Sleep until next poll
            time.sleep(self.POLL_INTERVAL)

    def _log_current_window(self):
        """Log the current window activity to database."""
        if self._current_window is None or self._window_start_time is None:
            return

        # Calculate duration
        duration = int((datetime.now() - self._window_start_time).total_seconds())

        # Only log if duration > 0
        if duration > 0:
            self.db.log_activity(
                timestamp=self._window_start_time.isoformat(),
                app_name=self._current_window.app_name,
                window_title=self._current_window.window_title,
                duration=duration
            )

    def _log_metrics(self):
        """Log input metrics to database."""
        key_presses, mouse_clicks, mouse_distance = self.input_tracker.get_metrics_and_reset()

        # Only log if there was any activity
        if key_presses > 0 or mouse_clicks > 0 or mouse_distance > 0:
            self.db.log_input_metrics(
                timestamp=datetime.now().isoformat(),
                key_presses=key_presses,
                mouse_clicks=mouse_clicks,
                mouse_distance=mouse_distance
            )

    def _handle_idle_state(self, idle_seconds: float):
        """Handle idle state transitions.

        Args:
            idle_seconds: Seconds since last input activity
        """
        # Transition to idle
        if not self._is_idle and idle_seconds >= self.IDLE_THRESHOLD:
            self._is_idle = True
            self._idle_start_time = datetime.now() - timedelta(seconds=idle_seconds)
            self._idle_period_id = self.db.start_idle_period(
                start_time=self._idle_start_time.isoformat()
            )
            print(f"User became idle at {self._idle_start_time.strftime('%H:%M:%S')}")

        # Transition from idle to active
        elif self._is_idle and idle_seconds < self.IDLE_THRESHOLD:
            if self._idle_period_id is not None and self._idle_start_time is not None:
                end_time = datetime.now()
                duration = int((end_time - self._idle_start_time).total_seconds())
                self.db.end_idle_period(
                    idle_id=self._idle_period_id,
                    end_time=end_time.isoformat(),
                    duration=duration
                )
                print(f"User became active again after {duration}s idle")

            self._is_idle = False
            self._idle_period_id = None
            self._idle_start_time = None
            self.input_tracker.reset_idle_timer()


# ============================================================================
# MAIN ENTRY POINT
# ============================================================================

def main():
    """Main entry point."""
    tracker = ActivityTracker()
    tracker.start()


if __name__ == "__main__":
    main()
