"""Main activity tracker daemon that aggregates and logs data."""
import time
import signal
import sys
from datetime import datetime, timedelta
from typing import Optional

from tracker.database import Database
from tracker.window_tracker import WindowTracker, WindowInfo
from tracker.input_tracker import InputTracker


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


def main():
    """Main entry point."""
    tracker = ActivityTracker()
    tracker.start()


if __name__ == "__main__":
    main()
