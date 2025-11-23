"""Track keyboard and mouse input using pynput."""
import threading
import time
from pynput import keyboard, mouse
from typing import Tuple


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

    def start(self):
        """Start tracking keyboard and mouse input."""
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

    def stop(self):
        """Stop tracking input."""
        if self._keyboard_listener:
            self._keyboard_listener.stop()
        if self._mouse_listener:
            self._mouse_listener.stop()

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
