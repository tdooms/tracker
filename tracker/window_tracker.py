"""Track active window using Windows API."""
import win32gui
import win32process
import psutil
from typing import Optional, Tuple
from dataclasses import dataclass


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
