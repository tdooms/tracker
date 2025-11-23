"""Database schema and initialization for activity tracker."""
import sqlite3
from pathlib import Path
from datetime import datetime
from typing import Optional


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
