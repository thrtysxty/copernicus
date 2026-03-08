#!/usr/bin/env python3
import logging
logger = logging.getLogger(__name__)
"""
Workflow Manager - Deterministic File System Backlog

Manages task tokens moving between persona queues.
Ensures atomic operations via staging directory and os.rename.
"""

import os
import sys
import json
import argparse
import uuid
from datetime import datetime

# Determine project root
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
WORKFLOW_ROOT = os.path.join(PROJECT_ROOT, "workflow")
QUEUES_DIR = os.path.join(WORKFLOW_ROOT, "queues")
ACTIVE_DIR = os.path.join(WORKFLOW_ROOT, "active")
STAGING_DIR = os.path.join(WORKFLOW_ROOT, "staging")

# Ensure staging exists
os.makedirs(STAGING_DIR, exist_ok=True)


def find_token(story_id):
    """
    Locates a task token file by story_id across all queues and active directory.
    Returns (filepath, directory_type) or (None, None).
    """
    token_filename = f"{story_id}.json"

    # Check active first
    active_path = os.path.join(ACTIVE_DIR, token_filename)
    if os.path.exists(active_path):
        return active_path, "active"

    # Check queues
    if os.path.exists(QUEUES_DIR):
        for persona in os.listdir(QUEUES_DIR):
            persona_dir = os.path.join(QUEUES_DIR, persona)
            if os.path.isdir(persona_dir):
                token_path = os.path.join(persona_dir, token_filename)
                if os.path.exists(token_path):
                    return token_path, "queue"

    return None, None


def create_token_data(story_id, initial_status="created", owner=None):
    """Creates a new token dictionary."""
    return {
        "story_id": story_id,
        "status": initial_status,
        "owner": owner,
        "history": [
            {
                "timestamp": datetime.now().isoformat(),
                "action": "created",
                "by": os.getenv("USER", "unknown"),
            }
        ],
    }


def save_token(filepath, token_data):
    """Saves token data to file atomically."""
    # Ensure directory exists
    os.makedirs(os.path.dirname(filepath), exist_ok=True)

    # Write to temp file then move
    temp_path = filepath + ".tmp"
    with open(temp_path, "w") as f:
        json.dump(token_data, f, indent=2)
    os.rename(temp_path, filepath)


def push_task(story_id, target_queue):
    """
    Pushes a task to a specific queue.
    Uses staging area to ensure atomic move.
    """
    target_dir = os.path.join(QUEUES_DIR, target_queue)
    if not os.path.exists(target_dir):
        logger.error("Error occurred", exc_info=True)
        sys.exit(1)

    # Use a unique staging filename
    staging_filename = f"{story_id}_{uuid.uuid4()}.json"
    staging_path = os.path.join(STAGING_DIR, staging_filename)

    # Attempt to lock/claim the token by moving it to staging
    token_data = None
    existing_path, location_type = find_token(story_id)

    if existing_path:
        try:
            # Atomic move to staging
            os.rename(existing_path, staging_path)
            print(f"Locked token {story_id} from {location_type} to staging.")

            # Load data from staging
            with open(staging_path, "r") as f:
                token_data = json.load(f)
        except FileNotFoundError:
            logger.error("Error occurred", exc_info=True)
            # Ideally retry recursively or loop, but for now exit to keep it simple
            sys.exit(1)
        except OSError as e:
            print(f"Error moving token: {e}")
            sys.exit(1)
        except json.JSONDecodeError:
            print("Warning: Corrupt token. Recreating.")
            token_data = create_token_data(story_id)
    else:
        # Create new token directly in staging
        token_data = create_token_data(
            story_id, initial_status=f"pushed_to_{target_queue}"
        )
        print(f"Creating new token for {story_id} in staging.")

    # Update history
    token_data["history"].append(
        {
            "timestamp": datetime.now().isoformat(),
            "action": f"pushed_to_{target_queue}",
            "by": os.getenv("USER", "unknown"),
        }
    )
    token_data["status"] = f"pending_{target_queue}"
    token_data["owner"] = target_queue

    # Save updated data to staging (overwrite in place)
    save_token(staging_path, token_data)

    # Move from staging to destination
    dest_path = os.path.join(target_dir, f"{story_id}.json")
    try:
        os.rename(staging_path, dest_path)
        print(f"Task {story_id} pushed to {target_queue}.")
    except OSError as e:
        print(f"Error finalize move to queue: {e}")
        # Try to restore to original location? Or leave in staging for manual recovery?
        print(f"Token left in staging: {staging_path}")
        sys.exit(1)


def pull_task(persona):
    """
    Pulls a task from the persona's queue to the active directory.
    Uses staging area to ensure atomic move.
    """
    queue_dir = os.path.join(QUEUES_DIR, persona)
    if not os.path.exists(queue_dir):
        logger.error("Error occurred", exc_info=True)
        sys.exit(1)

    # Find tasks in the queue
    files = [f for f in os.listdir(queue_dir) if f.endswith(".json")]
    if not files:
        print(f"No tasks in queue for {persona}.")
        return

    # Sort to pick oldest/first
    files.sort()

    claimed_file = None
    staging_path = None
    token_data = None
    story_id = None

    # Try to claim a file
    for filename in files:
        source_path = os.path.join(queue_dir, filename)
        story_id = filename.replace(".json", "")
        staging_filename = f"{story_id}_{uuid.uuid4()}.json"
        staging_path = os.path.join(STAGING_DIR, staging_filename)

        try:
            # Atomic move to staging
            os.rename(source_path, staging_path)
            claimed_file = filename
            print(f"Locked token {story_id} to staging.")
            break
        except FileNotFoundError:
            # Someone else took it, try next
            continue
        except OSError as e:
            print(f"Error accessing queue: {e}")
            continue

    if not claimed_file:
        print(f"Could not claim any tasks from {persona} (someone else took them?).")
        return

    # Load and update
    try:
        with open(staging_path, "r") as f:
            token_data = json.load(f)
    except json.JSONDecodeError:
        logger.error("Error occurred", exc_info=True)
        # Move to lost+found or just leave in staging?
        return

    token_data["history"].append(
        {
            "timestamp": datetime.now().isoformat(),
            "action": "pulled",
            "by": os.getenv("USER", "unknown"),
        }
    )
    token_data["status"] = "in_progress"
    token_data["owner"] = persona

    # Save updated data to staging
    save_token(staging_path, token_data)

    # Move to active
    dest_path = os.path.join(ACTIVE_DIR, f"{story_id}.json")
    try:
        os.rename(staging_path, dest_path)
        print(f"Task {story_id} pulled by {persona} and moved to active.")
    except OSError as e:
        print(f"Error finalizing move to active: {e}")
        print(f"Token left in staging: {staging_path}")
        sys.exit(1)


def status_task(story_id):
    path, location_type = find_token(story_id)
    if path:
        try:
            with open(path, "r") as f:
                data = json.load(f)
            print(f"Task: {story_id}")
            print(f"Location: {path}")
            print(f"Status: {data.get('status')}")
            print(f"Owner: {data.get('owner')}")
        except Exception as e:
            print(f"Error reading token: {e}")
    else:
        print(f"Task {story_id} not found.")


def list_queues():
    print("Queues:")
    for q in os.listdir(QUEUES_DIR):
        path = os.path.join(QUEUES_DIR, q)
        if os.path.isdir(path):
            count = len([f for f in os.listdir(path) if f.endswith(".json")])
            print(f"  - {q}: {count} tasks")

    active_count = len([f for f in os.listdir(ACTIVE_DIR) if f.endswith(".json")])
    print(f"Active: {active_count} tasks")


def main():
    parser = argparse.ArgumentParser(description="Workflow Manager")
    subparsers = parser.add_subparsers(dest="command", help="Command")

    push_parser = subparsers.add_parser("push", help="Push a task to a queue")
    push_parser.add_argument("story_id", help="Story ID (e.g., story_123)")
    push_parser.add_argument("queue", help="Target queue (persona)")

    pull_parser = subparsers.add_parser("pull", help="Pull a task from a queue")
    pull_parser.add_argument("persona", help="Persona pulling the task")

    status_parser = subparsers.add_parser("status", help="Get status of a task")
    status_parser.add_argument("story_id", help="Story ID")

    subparsers.add_parser("list", help="List queues and counts")

    args = parser.parse_args()

    if args.command == "push":
        push_task(args.story_id, args.queue)
    elif args.command == "pull":
        pull_task(args.persona)
    elif args.command == "status":
        status_task(args.story_id)
    elif args.command == "list":
        list_queues()
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
