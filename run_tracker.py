"""Simple runner script for the activity tracker."""
import sys
from pathlib import Path

# Add parent directory to path to enable imports
sys.path.insert(0, str(Path(__file__).parent))

from tracker.activity_tracker import ActivityTracker


def main():
    """Run the activity tracker daemon."""
    print("=" * 50)
    print("Activity Tracker v1.0.0")
    print("=" * 50)
    print("Press Ctrl+C to stop\n")

    try:
        tracker = ActivityTracker()
        tracker.start()
    except KeyboardInterrupt:
        print("\nShutdown requested by user")
        sys.exit(0)
    except Exception as e:
        print(f"\nFatal error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
