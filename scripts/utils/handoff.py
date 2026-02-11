#!/usr/bin/env python3
import sys


def main():
    notes = " ".join(sys.argv[1:])
    if not notes:
        print("Usage: /handoff {NOTES}")
        sys.exit(1)

    print("\n" + "=" * 60)
    print("👋 CONTEXT HANDOFF SIGNAL")
    print("=" * 60)
    print(f"FOCUS: {notes}")
    print("=" * 60)
    print("\nRECOMMENDATION: Run /compact or /clear now to reset context.")
    print("The next session should focus strictly on the notes above.\n")


if __name__ == "__main__":
    main()
