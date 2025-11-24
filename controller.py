"""Test script to verify controller detection"""
import time

try:
    from inputs import get_gamepad, devices
    print("inputs library loaded successfully")
    print(f"Detected devices: {devices}")

    if not devices.gamepads:
        print("\nNo gamepads detected!")
        print("Make sure your Xbox controller is connected and turned on.")
    else:
        print(f"\nFound {len(devices.gamepads)} gamepad(s)")
        for gamepad in devices.gamepads:
            print(f"  - {gamepad}")

        print("\nListening for controller input (press any button)...")
        print("Press Ctrl+C to stop\n")

        try:
            while True:
                events = get_gamepad()
                for event in events:
                    print(f"{event.ev_type:10s} | {event.code:15s} | {event.state:6d}")
        except KeyboardInterrupt:
            print("\nStopped")

except ImportError:
    print("ERROR: 'inputs' library not installed")
    print("Install it with: pip install inputs")
except Exception as e:
    print(f"Error: {e}")
