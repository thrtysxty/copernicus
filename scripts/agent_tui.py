#!/usr/bin/env python3
"""
COPERNICUS IDE - Agent TUI (Claude Code Style)
A single-stream, chat-based interface for the agentic workflow.
"""

import os
import sys
import subprocess
import difflib
import datetime
from pathlib import Path

# Load environment variables early, before any imports that might need them
try:
    from dotenv import load_dotenv

    load_dotenv()
except ImportError:
    pass
from dataclasses import dataclass
from textual.app import App, ComposeResult
from textual.widgets import (
    Input,
    Static,
    Label,
    Markdown,
    LoadingIndicator,
    Collapsible,
    TextArea,
    OptionList,
    Select,
    Button,
)
from textual.widgets.option_list import Option
from textual.containers import Vertical, VerticalScroll, Horizontal
from textual.binding import Binding
from textual import work, on
from textual.events import Key
from textual.screen import ModalScreen
from textual.worker import Worker
from textual.message import Message

# Ensure we can import the bridge and telemetry
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
# Add project root for src imports
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from unified_agent_bridge import UnifiedAgentBridge  # noqa: E402

# Import telemetry for subagent tracking (optional - graceful degradation)
try:
    from src.agentic.telemetry import telemetry  # noqa: E402

    HAS_TELEMETRY = True
except ImportError:
    HAS_TELEMETRY = False
    telemetry = None  # type: ignore[assignment]

# Import DevTimeManager gracefully
try:
    from devtime_manager import DevTimeManager

    HAS_DEVTIME = True
except ImportError:
    HAS_DEVTIME = False
    DevTimeManager = None  # type: ignore[assignment]

# File size limit for attachments (100KB)
MAX_FILE_SIZE = 100 * 1024  # 100KB to support larger source files


@dataclass
class BackgroundTask:
    """Store state of a backgrounded task.

    Test: Should store task ID, command, agent message, accumulated text, and worker
    Test: worker can be None if task has completed
    Test: ID should be unique per task
    """

    id: int
    command: str
    agent_msg: "AgentMessage"
    accumulated_text: str
    worker: Worker | None


class SubmitTextArea(TextArea):
    """TextArea that submits on Enter instead of adding newline."""

    class Submitted(Message):
        """Posted when user presses Enter."""

        def __init__(self, text: str) -> None:
            self.text = text
            super().__init__()

    class HistoryUp(Message):
        """Posted when user presses Up arrow for history."""

    class HistoryDown(Message):
        """Posted when user presses Down arrow for history."""

    class ScrollUp(Message):
        """Posted when user presses PageUp."""

    class ScrollDown(Message):
        """Posted when user presses PageDown."""

    class LineScrollUp(Message):
        """Posted when user presses Up arrow."""

    class LineScrollDown(Message):
        """Posted when user presses Down arrow."""

    async def _on_key(self, event: Key) -> None:
        """Intercept keys for submit and history navigation."""
        # Prioritize chat scrolling over cursor movement in the input
        if event.key == "up":
            event.stop()
            event.prevent_default()
            self.post_message(self.LineScrollUp())
            return
        if event.key == "down":
            event.stop()
            event.prevent_default()
            self.post_message(self.LineScrollDown())
            return
        if event.key == "shift+up":
            event.stop()
            event.prevent_default()
            self.post_message(self.ScrollUp())
            return
        if event.key == "shift+down":
            event.stop()
            event.prevent_default()
            self.post_message(self.ScrollDown())
            return
        if event.key == "ctrl+up":
            event.stop()
            event.prevent_default()
            self.post_message(self.HistoryUp())
            return
        if event.key == "ctrl+down":
            event.stop()
            event.prevent_default()
            self.post_message(self.HistoryDown())
            return
        if event.key == "enter":
            event.stop()
            event.prevent_default()
            self.post_message(self.Submitted(self.text))
        else:
            await super()._on_key(event)


class PersonaAutocomplete(OptionList):
    """Autocomplete dropdown for persona commands.

    Test: Should be hidden by default
    Test: Should populate with persona names from bridge.persona_files
    Test: Should position above TextArea as popup
    Test: Arrow keys should navigate options (built into OptionList)
    Test: Enter should select option and insert into TextArea
    Test: Escape should hide the autocomplete
    """

    DEFAULT_CSS = """
    PersonaAutocomplete {
        display: none;
    }
    """

    def __init__(self):
        super().__init__()


class FilePickerScreen(ModalScreen):
    """Simple file picker modal that asks for file path.

    Test: Should display on Ctrl+O key press
    Test: Should dismiss on Escape key press
    Test: Should validate file exists before dismissing
    Test: Should check file size is under MAX_FILE_SIZE
    Test: Should show error message for invalid files
    Test: Input should be focused on mount
    """

    BINDINGS = [
        Binding("escape", "dismiss", "Cancel"),
    ]

    def compose(self) -> ComposeResult:
        # Test: Should display instruction text
        # Test: Should have an Input widget for file path
        yield Static("[dim]attach file (max 100KB)[/dim]", id="file-picker-label")
        yield Input(id="file-path-input", placeholder="e.g., /path/to/file.py")
        yield Static("", id="file-picker-error", classes="error-message")

    def on_mount(self) -> None:
        """Focus the input on mount."""
        # Test: Input should receive focus on modal open
        self.query_one("#file-path-input", Input).focus()

    def on_input_submitted(self, event: Input.Submitted) -> None:
        """Handle file path submission."""
        # Test: Empty path should be dismissed with None
        # Test: Non-existent file should show error message
        # Test: File > MAX_FILE_SIZE should show error message
        # Test: Valid file should dismiss with path
        path = event.value.strip()

        if not path:
            self.dismiss(None)
            return

        # Validate file
        file_path = Path(path).expanduser()
        error_widget = self.query_one("#file-picker-error", Static)

        if not file_path.exists():
            error_widget.update("Error: File does not exist")
            return

        if not file_path.is_file():
            error_widget.update("Error: Path is not a file")
            return

        try:
            file_size = file_path.stat().st_size
            if file_size > MAX_FILE_SIZE:
                error_widget.update(
                    f"Error: File too large ({file_size} bytes > {MAX_FILE_SIZE} bytes)"
                )
                return
        except OSError as e:
            error_widget.update(f"Error: Cannot read file: {e}")
            return

        # Valid file, dismiss with absolute path
        self.dismiss(str(file_path.absolute()))


class TaskListScreen(ModalScreen):
    """Display and select background tasks.

    Test: Should display on Ctrl+T key press
    Test: Should show list of all background tasks with IDs and commands
    Test: Should dismiss on Escape key press
    Test: Arrow keys should navigate task list (built into OptionList)
    Test: Enter should select a task and restore it to foreground
    Test: Should be centered on screen
    Test: Should show "No background tasks" if list is empty
    """

    BINDINGS = [
        Binding("escape", "dismiss", "Cancel"),
    ]

    def __init__(self, tasks: list[BackgroundTask]):
        super().__init__()
        self.tasks = tasks

    def compose(self) -> ComposeResult:
        # Claude Code style: minimal, no ASCII art borders
        yield Static("[dim]Background Tasks[/dim]", id="task-list-title")

        if not self.tasks:
            yield Static("[dim]No background tasks[/dim]", id="no-tasks-message")
        else:
            task_list = OptionList(id="task-option-list")
            for task in self.tasks:
                cmd_display = (
                    task.command[:35] + "..."
                    if len(task.command) > 35
                    else task.command
                )
                task_list.add_option(
                    Option(f"{task.id}: {cmd_display}", id=str(task.id))
                )
            yield task_list

        yield Static(
            "[dim]↑↓ select · enter restore · esc cancel[/dim]", id="task-list-help"
        )

    def on_mount(self) -> None:
        """Focus the task list on mount."""
        # Test: OptionList should receive focus if tasks exist
        if self.tasks:
            task_list = self.query_one("#task-option-list", OptionList)
            task_list.focus()

    def on_option_list_option_selected(self, event: OptionList.OptionSelected) -> None:
        """Handle task selection."""
        # Test: Should dismiss with selected task ID
        # Test: Task ID should be extracted from option.id
        if event.option.id is not None:
            task_id = int(event.option.id)
            self.dismiss(task_id)


class SubagentActivity(Static):
    """A widget to display real-time sub-agent activity."""

    class SubagentStatus(Message):
        """Message to update the sub-agent status display."""

        def __init__(self, agents: list[dict]) -> None:
            self.agents = agents
            super().__init__()

    def on_mount(self) -> None:
        """Start with a default message."""
        self.update("[dim]No running sub-agents.[/dim]")

    def on_subagent_activity_subagent_status(self, message: SubagentStatus) -> None:
        """Update the display with the latest agent statuses."""
        if not message.agents:
            self.update("[dim]No running sub-agents.[/dim]")
            return

        status_text = []
        for agent in message.agents:
            name = agent.get("name", "unknown")
            role = agent.get("role", "")
            task = agent.get("task_description", "No task description")
            status = f"[cyan]● {name}[/cyan]"
            if role:
                status += f" [dim]({role})[/dim]"
            status += f"\n  [white]{task}[/white]"
            status_text.append(status)
        self.update("\n".join(status_text))

    DEFAULT_CSS = """
    SubagentActivity {
        padding: 0 1;
        border-top: solid $surface;
        color: $text;
        height: auto;
        max-height: 10;
        overflow-y: auto;
    }
    """


class SubagentStatusScreen(ModalScreen):
    """Display detailed status of running subagents.

    Test: Should display on Ctrl+S key press
    Test: Should show all running subagents with their tasks
    Test: Should dismiss on Escape or any key
    Test: Should show "No subagents running" if none
    """

    BINDINGS = [
        Binding("escape", "dismiss", "Close"),
        Binding("c", "cleanup", "Cleanup Stale"),
    ]

    def __init__(self, agents: list[dict]):
        super().__init__()
        self.agents = agents

    def compose(self) -> ComposeResult:
        yield Static("[bold]Running Subagents[/bold]", id="subagent-title")

        with VerticalScroll(id="subagent-scroll"):
            if not self.agents:
                yield Static(
                    "[dim]No subagents currently running[/dim]", id="no-subagents"
                )
            else:
                for agent in self.agents:
                    name = agent.get("name", "unknown")
                    role = agent.get("role", "")
                    task = agent.get("task_description", "No task description")
                    created = agent.get("created_at", "")

                    # Format: name (role) - task
                    agent_info = f"[cyan]● {name}[/cyan]"
                    if role:
                        agent_info += f" [dim]({role})[/dim]"
                    yield Static(agent_info, classes="subagent-name")
                    yield Static(f"  [white]{task}[/white]", classes="subagent-task")
                    if created:
                        yield Static(
                            f"  [dim]Started: {created}[/dim]", classes="subagent-time"
                        )

        yield Static("\n[dim]c: cleanup stale · esc: close[/dim]", id="subagent-hints")

    def on_key(self, event: Key) -> None:
        """Handle key presses."""
        if event.key == "c":
            event.stop()
            self.dismiss("cleanup")
        else:
            event.stop()
            self.dismiss()

    DEFAULT_CSS = """
    SubagentStatusScreen { align: center middle; background: $background 60%; }
    #subagent-title { width: 60; text-align: center; padding: 1; background: $primary; }
    #no-subagents { width: 60; text-align: center; padding: 1; }
    .subagent-name { width: 60; padding: 0 1; }
    .subagent-task { width: 60; padding: 0 1; }
    .subagent-time { width: 60; padding: 0 1; margin-bottom: 1; }
    #subagent-hints { width: 64; text-align: center; }
    """


class DevTimeModal(ModalScreen):
    """Modal to start a development session.

    Test: Should display on startup if no session active
    Test: Should capture entity, component, phase, story_id
    Test: Should show capitalizable status live
    Test: Should handle existing session (crash recovery)
    """

    CSS = """
    DevTimeModal {
        align: center middle;
        background: $background 80%;
    }
    #devtime-container {
        width: 60;
        height: auto;
        background: $surface;
        border: solid $surface-lighten-1;
        padding: 1 2;
    }
    #devtime-title {
        text-align: center;
        background: $primary;
        color: $text;
        padding: 1;
        margin-bottom: 1;
    }
    .devtime-row {
        height: auto;
        margin-bottom: 1;
    }
    .devtime-label {
        width: 12;
        padding-top: 1;
    }
    #devtime-cap-status {
        text-align: center;
        margin: 1 0;
        padding: 1;
        border: dashed $text-muted;
    }
    #devtime-buttons {
        align: center middle;
        height: 3;
        margin-top: 1;
    }
    Button {
        margin: 0 1;
    }
    """

    def __init__(self, manager):
        super().__init__()
        self.manager = manager
        self.existing_session = manager.get_context()

    def compose(self) -> ComposeResult:
        with Vertical(id="devtime-container"):
            if self.existing_session:
                yield Static("⚠ Session Already Open", id="devtime-title")

                # Format duration
                start_time = self.existing_session.get("start_time", "")
                elapsed = "unknown"
                if start_time:
                    try:
                        st = datetime.datetime.fromisoformat(start_time)
                        diff = datetime.datetime.now() - st
                        h, r = divmod(diff.seconds, 3600)
                        m = r // 60
                        elapsed = f"{h}h {m}m"
                    except:
                        pass

                info = f"{self.existing_session.get('financial_category')} · {self.existing_session.get('component')} · {elapsed} elapsed"
                yield Static(info, classes="devtime-row")

                with Horizontal(id="devtime-buttons"):
                    yield Button("Continue", variant="primary", id="btn-continue")
                    yield Button(
                        "Close & Start New", variant="error", id="btn-close-new"
                    )

            else:
                yield Static("Dev Session", id="devtime-title")

                with Horizontal(classes="devtime-row"):
                    yield Label("Type:", classes="devtime-label")
                    yield Select.from_values(
                        ["CAPEX", "OPEX", "NONE"], value="CAPEX", id="sel-financial"
                    )

                with Horizontal(classes="devtime-row"):
                    yield Label("Component:", classes="devtime-label")
                    # List from requirements
                    components = [
                        "platform_core",
                        "agent_logic",
                        "ui_shell",
                        "security_gate",
                        "telemetry",
                        "scaffolding",
                        "deployment",
                        "other",
                    ]
                    yield Select.from_values(
                        components, value="platform_core", id="sel-component"
                    )

                with Horizontal(classes="devtime-row"):
                    yield Label("Phase:", classes="devtime-label")
                    phases = [
                        "DEVELOPMENT",
                        "PRELIMINARY",
                        "POST_IMPLEMENTATION",
                    ]
                    yield Select.from_values(
                        phases, value="DEVELOPMENT", id="sel-phase"
                    )

                with Horizontal(classes="devtime-row"):
                    yield Label("Story ID:", classes="devtime-label")
                    yield Input(placeholder="story_087", id="inp-story")

                yield Static(
                    "✅ CAPITALIZABLE (CAPEX · DEVELOPMENT)", id="devtime-cap-status"
                )

                with Horizontal(id="devtime-buttons"):
                    yield Button("Start Session", variant="success", id="btn-start")
                    yield Button("Skip", variant="default", id="btn-skip")

    def on_select_changed(self, event: Select.Changed) -> None:
        self._update_cap_status()

    def _update_cap_status(self) -> None:
        if self.existing_session:
            return

        financial = self.query_one("#sel-financial", Select).value
        phase = self.query_one("#sel-phase", Select).value

        status = self.query_one("#devtime-cap-status", Static)
        if financial == "CAPEX" and phase == "DEVELOPMENT":
            status.update("✅ CAPITALIZABLE (CAPEX · DEVELOPMENT)")
            status.styles.color = "$success"
        else:
            status.update("⬜ NOT CAPITALIZABLE")
            status.styles.color = "$text-muted"

    def on_button_pressed(self, event: Button.Pressed) -> None:
        if event.button.id == "btn-skip":
            self.dismiss(None)

        elif event.button.id == "btn-continue":
            self.dismiss("continue")

        elif event.button.id == "btn-close-new":
            # Close existing session first
            try:
                self.manager.close_session("Closed to start new session", None)
            except Exception as e:
                self.app.notify(f"Error closing session: {e}", severity="error")

            self.dismiss("restart")

        elif event.button.id == "btn-start":
            financial = self.query_one("#sel-financial", Select).value
            component = self.query_one("#sel-component", Select).value
            phase = self.query_one("#sel-phase", Select).value
            story_id = self.query_one("#inp-story", Input).value

            if not all([financial, component, phase]):
                self.app.notify("Please fill all fields", severity="error")
                return

            try:
                self.manager.open_session(financial, component, phase, story_id)
                self.dismiss("started")
            except Exception as e:
                self.app.notify(f"Error starting session: {e}", severity="error")


class DevTimeCloseModal(ModalScreen):
    """Modal to close a development session.

    Test: Should display on quit if session active
    Test: Should show duration and recent commits
    Test: Should capture description and commits
    """

    CSS = """
    DevTimeCloseModal {
        align: center middle;
        background: $background 80%;
    }
    #close-container {
        width: 70;
        height: auto;
        background: $surface;
        border: solid $surface-lighten-1;
        padding: 1 2;
    }
    #close-title {
        text-align: center;
        background: $primary;
        color: $text;
        padding: 1;
        margin-bottom: 1;
    }
    .close-row {
        height: auto;
        margin-bottom: 1;
    }
    #close-commits-list {
        height: 5;
        border: solid $surface-lighten-2;
        background: $surface-darken-1;
        margin-bottom: 1;
        padding: 0 1;
        color: $text-muted;
    }
    """

    def __init__(self, manager):
        super().__init__()
        self.manager = manager
        self.duration = manager.get_elapsed_seconds() / 3600.0
        self.recent_commits = manager.get_recent_commits()

    def compose(self) -> ComposeResult:
        with Vertical(id="close-container"):
            yield Static("Close Session", id="close-title")

            duration_text = f"{self.duration:.2f}h"
            yield Static(f"Duration: {duration_text}", classes="close-row")

            yield Label("Recent commits:", classes="close-row")
            commits_text = (
                "\n".join(self.recent_commits)
                if self.recent_commits
                else "[No recent commits]"
            )
            yield Static(commits_text, id="close-commits-list")

            yield Label("Commits (copy/paste from above):", classes="close-row")
            # Pre-fill with top commit if available?
            default_commit = (
                self.recent_commits[0].split(" ", 1)[0] if self.recent_commits else ""
            )
            yield Input(
                value=default_commit, placeholder="e.g. a1b2c3d", id="inp-commits"
            )

            yield Label("Notes:", classes="close-row")
            yield Input(placeholder="Work description...", id="inp-notes")

            with Horizontal(classes="close-row"):
                yield Button("Save & Quit", variant="success", id="btn-save")
                yield Button(
                    "Quit Without Saving", variant="error", id="btn-quit-nosave"
                )

    def on_button_pressed(self, event: Button.Pressed) -> None:
        if event.button.id == "btn-quit-nosave":
            try:
                if self.manager.LOCK_PATH.exists():
                    self.manager.LOCK_PATH.unlink()
            except:
                pass
            self.dismiss("quit")

        elif event.button.id == "btn-save":
            commits = self.query_one("#inp-commits", Input).value
            notes = self.query_one("#inp-notes", Input).value

            if not notes:
                self.app.notify("Please add notes", severity="error")
                return

            try:
                self.manager.close_session(notes, commits)
                self.dismiss("quit")
            except Exception as e:
                self.app.notify(f"Error saving session: {e}", severity="error")


class InlineDiffViewer(Static):
    """An inline diff viewer."""

    class DiffReviewed(Message):
        def __init__(self, accepted: bool) -> None:
            self.accepted = accepted
            super().__init__()

    def __init__(self, file_path: str, old_content: str, new_content: str):
        super().__init__(classes="inline-diff")
        self.file_path = file_path
        self.old_content = old_content
        self.new_content = new_content

    def on_mount(self) -> None:
        self.focus()

    def compose(self) -> ComposeResult:
        old_lines = self.old_content.splitlines(keepends=True)
        new_lines = self.new_content.splitlines(keepends=True)
        diff_lines = [
            line
            for line in difflib.unified_diff(
                old_lines,
                new_lines,
                fromfile="original",
                tofile="modified",
                lineterm="",
            )
        ]

        additions, deletions = self._calculate_diff_stats(diff_lines)
        stats_text = f"[green]+{additions}[/green] [red]-{deletions}[/red]"
        yield Static(f"[dim]write[/dim] {self.file_path}  {stats_text}")

        if not diff_lines:
            diff_text = "[No changes detected]"
        else:
            diff_text = self._format_diff(diff_lines)

        # Use a non-scrollable Static for the diff content itself
        yield Static(diff_text, classes="diff-content")
        yield Static("[dim]y[/dim] accept  [dim]n[/dim] reject  [dim]esc[/dim] cancel")

    def on_key(self, event: Key) -> None:
        if event.key == "y":
            event.stop()
            self.post_message(self.DiffReviewed(True))
            self.remove()
        elif event.key in ("n", "escape"):
            event.stop()
            self.post_message(self.DiffReviewed(False))
            self.remove()

    def _calculate_diff_stats(self, diff_lines: list[str]) -> tuple[int, int]:
        additions = sum(
            1
            for line in diff_lines
            if line.startswith("+") and not line.startswith("+++")
        )
        deletions = sum(
            1
            for line in diff_lines
            if line.startswith("-") and not line.startswith("---")
        )
        return additions, deletions

    def _format_diff(self, diff_lines: list[str]) -> str:
        formatted = []
        for line in diff_lines:
            line = line.rstrip("\n")
            if line.startswith("+") and not line.startswith("+++"):
                formatted.append(f"[green]{line}[/green]")
            elif line.startswith("-") and not line.startswith("---"):
                formatted.append(f"[red]{line}[/red]")
            elif line.startswith("@@"):
                formatted.append(f"[cyan bold]{line}[/cyan bold]")
            else:
                formatted.append(line)
        return "\n".join(formatted)


class InlineConfirmation(Static):
    """An inline confirmation prompt for commands."""

    class Confirmed(Message):
        def __init__(self, command: str, accepted: bool) -> None:
            self.command = command
            self.accepted = accepted
            super().__init__()

    def __init__(self, command: str) -> None:
        super().__init__(classes="inline-confirmation")
        self.command = command

    def compose(self) -> ComposeResult:
        yield Static("[bold red]⚠️  Execute Command?[/bold red]")
        yield Static(f"[cyan]{self.command}[/cyan]")
        yield Static("[dim]y[/dim] execute  [dim]n/esc[/dim] cancel")

    def on_mount(self) -> None:
        self.focus()

    def on_key(self, event: Key) -> None:
        if event.key == "y":
            event.stop()
            self.post_message(self.Confirmed(self.command, True))
            self.remove()
        elif event.key in ("n", "escape"):
            event.stop()
            self.post_message(self.Confirmed(self.command, False))
            self.remove()


class HelpOverlay(ModalScreen):
    """Display keyboard shortcuts help overlay.

    Test: Should display on ? key press
    Test: Should display on ctrl+slash key press
    Test: Should dismiss on Escape key press
    Test: Should dismiss on any other key press
    Test: Should be centered on screen
    Test: Should have semi-transparent background
    Test: Help text should include all keyboard shortcuts grouped by category
    """

    BINDINGS = [
        Binding("escape", "dismiss", "Close"),
    ]

    def compose(self) -> ComposeResult:
        # Claude Code style: clean, minimal help text (matching Claude Code keybindings)
        help_text = """[bold]Keyboard Shortcuts[/bold]

[dim]General[/dim]
  ctrl+d      quit
  ctrl+c      cancel
  ?           this help

[dim]Input[/dim]
  enter       submit
  shift+enter new line
  ↑ ↓         scroll chat lines
  shift+↑ ↓   scroll chat pages
  ctrl+↑ ↓    history
  @file       attach file

[dim]View[/dim]
  ctrl+o      collapse/expand

[dim]Edits[/dim]
  y           accept edit
  n           reject edit
  a           accept all

[dim]Tasks[/dim]
  ctrl+b      background
  ctrl+t      task list
  ctrl+s      subagent status
  /cleanup    clear stale agents

[dim]Personas[/dim]
  /           autocomplete
  /provider   switch model

[dim]press any key to close[/dim]"""
        yield Static(help_text, id="help-content")

    def on_key(self, event: Key) -> None:
        """Dismiss help overlay on any key press (except special handling keys)."""
        # Test: Any key press should dismiss the overlay
        # Test: Should not interfere with Escape binding
        if event.key != "escape":
            self.dismiss()


class FileAttachment(Static):
    """Display attached files as pills/tags.

    Test: Should render each file as a pill with filename only (not full path)
    Test: Pills should be displayed horizontally with spacing
    Test: Should show "X" or remove indicator for each file
    Test: Should be hidden when no files are attached
    """

    def __init__(self, files: list[str]):
        super().__init__(id="attached-files")
        self.files = files

    def compose(self) -> ComposeResult:
        # Test: Should create a label for each file
        # Test: Filename should be extracted from path
        if not self.files:
            return

        file_pills = "  ".join([f"📎 {Path(f).name}" for f in self.files])
        yield Label(file_pills, classes="file-pills")


class UserMessage(Static):
    """Display user input with minimal styling - just a prefix."""

    def __init__(self, content: str):
        # Claude Code style: simple "> " prefix for user messages
        super().__init__(f"[bold]>[/bold] {content}")


class AgentMessage(Vertical):
    """Container for agent output (Text + Tools) in a collapsible wrapper."""

    def __init__(self, persona: str, provider: str):
        super().__init__()
        self.persona = persona
        self.provider = provider
        # Textual's Markdown widget uses Rich internally for syntax highlighting
        self.text_widget = Markdown("")
        self.spinner = None  # Reference to LoadingIndicator
        self.is_loading = True  # Track loading state
        self.collapsible = None  # Reference to Collapsible wrapper
        self.content = ""  # Store content for title preview

    def compose(self) -> ComposeResult:
        # Test: AgentMessage should be wrapped in Collapsible
        # Test: Should start expanded (collapsed=False)
        # Test: Title should show persona name with visible activity indicator
        self.collapsible = Collapsible(
            title=f"● {self.persona} - generating...",
            collapsed=False,
            classes="agent-collapsible",
        )
        with self.collapsible:
            # Test: LoadingIndicator should be visible initially
            self.spinner = LoadingIndicator(id="agent-spinner")
            yield self.spinner
            yield self.text_widget
        yield self.collapsible

    def update_text(self, content: str):
        # Test: First call to update_text should hide spinner
        # Test: is_loading should transition from True to False
        # Test: Title should update with content preview
        if self.is_loading and self.spinner:
            self.spinner.display = False  # Hide spinner on first content
            self.is_loading = False
        self.content = content
        self.text_widget.update(content)
        # Update title with preview (first 50 chars of first line)
        if self.collapsible:
            preview = content.split("\n")[0][:50]
            if len(content.split("\n")[0]) > 50:
                preview += "..."
            self.collapsible.title = f"⏵ {self.persona}: {preview}"

    def collapse_message(self):
        """Collapse this message to reduce clutter."""
        if self.collapsible:
            self.collapsible.collapsed = True

    def expand_message(self):
        """Expand this message."""
        if self.collapsible:
            self.collapsible.collapsed = False


class ToolExecution(Vertical):
    """Display tool usage in a collapsible container."""

    def __init__(self, tool_name: str, args: str):
        super().__init__()
        self.tool_name = tool_name
        self.args = args
        self.result_widget = Static("Running...", classes="tool-result")
        self.collapsible = None
        self._tool_running = True  # Renamed to avoid Widget conflict

    def compose(self) -> ComposeResult:
        # Test: Collapsible should start with "⏳" while running
        # Test: Title format should be "🛠️ tool_name: ⏳"
        title = f"⏵ {self.tool_name}: ⏳"
        self.collapsible = Collapsible(
            title=title,
            collapsed=False,  # Start expanded while running
            classes="tool-collapsible",
        )
        with self.collapsible:
            # Test: Args should be displayed with label
            yield Label(f"Args: {self.args}", classes="tool-args")
            yield self.result_widget
        yield self.collapsible

    def update_result(self, result: str):
        # Test: update_result should change status icon from ⏳ to ✓
        # Test: Collapsible should collapse after result arrives
        # Test: Result widget should display the result text
        if self.collapsible and self._tool_running:
            self._tool_running = False
            # Update title to show completion
            self.collapsible.title = f"⏵ {self.tool_name}: ✓"
            # Collapse the widget
            self.collapsible.collapsed = True
        self.result_widget.update(result)
        self.add_class("completed")


class StatusBar(Static):
    """Display git branch, working directory, provider, active story, background task count, and file changes."""

    def __init__(self, provider: str):
        # Test: StatusBar should initialize with provider name
        super().__init__()
        self.provider = provider
        self.story = None
        self.task_count = 0
        self.files_changed = 0  # Track files modified this session
        self.total_additions = 0  # Track total lines added
        self.total_deletions = 0  # Track total lines removed
        self.is_working = False  # Track if agent is actively working
        self.current_task = ""  # Current task description (persona + query preview)
        self.subagent_count = 0  # Number of running subagents
        self.running_agents: list[dict] = []  # Full agent info from telemetry
        self.session_info = None

    def set_session_info(self, info: str) -> None:
        """Set the session info text and update display."""
        self.session_info = info
        self.update(self.compose_status_text())

    def get_git_branch(self) -> str:
        """Fetch current git branch name."""
        # Test: Should return branch name when in git repo
        # Test: Should return "no-git" when not in git repo or on error
        try:
            result = subprocess.check_output(
                ["git", "branch", "--show-current"],
                stderr=subprocess.DEVNULL,
                text=True,
                timeout=2,
            )
            branch = result.strip()
            return branch if branch else "detached"
        except (
            subprocess.CalledProcessError,
            subprocess.TimeoutExpired,
            FileNotFoundError,
        ):
            return "no-git"

    def get_cwd_basename(self) -> str:
        """Get basename of current working directory."""
        # Test: Should return directory name, not full path
        return Path.cwd().name

    def compose_status_text(self) -> str:
        """Compose the status line text - Claude Code style: minimal."""
        branch = self.get_git_branch()
        parts = [branch, self.provider.lower()]

        if self.session_info:
            parts.append(self.session_info)

        # Show working indicator with task details
        if self.is_working:
            if self.current_task:
                parts.append(f"[yellow]● {self.current_task}[/yellow]")
            else:
                parts.append("[yellow]● working[/yellow]")

        return " · ".join(parts)

    def on_mount(self) -> None:
        """Update status text on mount."""
        # Test: Status bar should display composed text on mount
        self.update(self.compose_status_text())

    def update_status(
        self,
        story: str | None = None,
        task_count: int | None = None,
        file_change: tuple[int, int] | None = None,
    ):
        """Update the status bar with new story info, task count, or file change.

        Args:
            story: Story name to display
            task_count: Number of background tasks
            file_change: Tuple of (additions, deletions) for a file change
        """
        # Test: Calling update_status should refresh the displayed text
        # Test: Story parameter should be optional
        # Test: task_count parameter should be optional
        # Test: task_count should update the displayed task count
        # Test: file_change should increment files_changed counter
        if story is not None:
            self.story = story
        if task_count is not None:
            self.task_count = task_count
        if file_change is not None:
            additions, deletions = file_change
            self.files_changed += 1
            self.total_additions += additions
            self.total_deletions += deletions
        self.update(self.compose_status_text())

    def set_working(self, working: bool, task: str = "") -> None:
        """Set the working state and update display.

        Args:
            working: Whether the agent is currently working
            task: Description of current task (e.g., "architect: review code")
        """
        self.is_working = working
        self.current_task = task if working else ""
        # Toggle CSS class for visual highlight
        if working:
            self.add_class("-working")
        else:
            self.remove_class("-working")
        self.update(self.compose_status_text())

    def set_subagent_count(self, count: int, agents: list[dict] | None = None) -> None:
        """Update the subagent count and details, then refresh display.

        Args:
            count: Number of running subagents
            agents: Full list of agent dicts from telemetry (optional)
        """
        self.subagent_count = count
        self.running_agents = agents or []
        self.update(self.compose_status_text())


class TokenDisplay(Static):
    """Display token usage and cost estimate in the footer.

    Test: Should initialize with 0 tokens and $0.00 cost
    Test: Should format tokens with 'k' suffix for thousands (e.g., 1.2k)
    Test: Should display whole numbers for tokens < 1000
    Test: Should calculate cost based on provider (Gemini vs Ollama)
    Test: Ollama should always show $0.00
    Test: Should update display when update_tokens() is called
    """

    def __init__(self, provider: str):
        super().__init__()
        self.provider = provider.lower()
        self.session_tokens = 0
        self.last_request_tokens = 0

    def format_tokens(self, tokens: int) -> str:
        """Format token count with 'k' suffix for thousands.

        Test: 0 -> "0"
        Test: 500 -> "500"
        Test: 1000 -> "1.0k"
        Test: 1234 -> "1.2k"
        Test: 12345 -> "12.3k"
        """
        if tokens < 1000:
            return str(tokens)
        return f"{tokens / 1000:.1f}k"

    def calculate_cost(self, tokens: int) -> float:
        """Calculate cost estimate based on provider and token count.

        Test: Ollama should return 0.0 for any token count
        Test: Gemini should use $0.00025 per 1K tokens (conservative estimate)
        Test: Cost calculation: (tokens / 1000) * 0.00025
        """
        if self.provider == "ollama":
            return 0.0
        # Gemini Pro pricing (using midpoint of input/output rates as estimate)
        # Input: $0.000125/1K, Output: $0.000375/1K (using midpoint $0.00025)
        return (tokens / 1000) * 0.00025

    def compose_display_text(self) -> str:
        """Compose the token display text.

        Test: Format should be "Tokens: X.Xk ($X.XXX)"
        Test: Cost should show 3 decimal places
        Test: Should show session total, not just last request
        """
        tokens_str = self.format_tokens(self.session_tokens)
        cost = self.calculate_cost(self.session_tokens)
        return f"Tokens: {tokens_str} (${cost:.3f})"

    def on_mount(self) -> None:
        """Initialize display on mount.

        Test: Should display "Tokens: 0 ($0.000)" on mount
        """
        self.update(self.compose_display_text())

    def update_tokens(self, tokens: int) -> None:
        """Update token count and refresh display.

        Test: Should add tokens to session_tokens
        Test: Should update last_request_tokens
        Test: Should refresh the display text
        Test: Should handle negative tokens gracefully (ignore them)
        """
        if tokens < 0:
            return
        self.last_request_tokens = tokens
        self.session_tokens += tokens
        self.update(self.compose_display_text())


class AgentTui(App):
    # Claude Code style: minimal, clean, terminal-native aesthetic
    CSS = """
    Screen {
        layout: vertical;
        background: $background;
    }

    /* Status - top line like Claude Code "main > project > tokens" */
    StatusBar {
        dock: top;
        height: 1;
        padding: 0 1;
        color: $text;
        background: $surface;
    }
    StatusBar.-working {
        background: $warning 20%;
    }

    /* Main chat area - fills remaining space */
    #chat-scroll {
        height: 1fr;
        padding: 0 1;
        scrollbar-size: 1 1;
    }

    /* Activity Panel */
    #activity-panel {
        dock: bottom;
        height: auto;
        max-height: 12;
        background: $surface-darken-1;
    }
    #activity-panel > CollapsibleTitle {
        color: $text-muted;
        background: $surface-darken-2;
    }

    /* Token display - above input, right-aligned */
    TokenDisplay {
        dock: bottom;
        height: 1;
        padding: 0 1;
        color: $text-muted;
        text-align: right;
        background: transparent;
    }

    /* Input section container */
    #input-section {
        dock: bottom;
        height: auto;
        max-height: 10;
        background: $surface;
        padding: 0;
    }

    /* Input row: prompt + textarea */
    #input-row {
        height: auto;
        min-height: 1;
        max-height: 8;
        padding: 0 1;
    }

    /* Input prompt "> " */
    #input-prompt {
        width: 3;
        height: 1;
        padding: 0;
        background: transparent;
    }

    /* Input area */
    #input-box {
        width: 1fr;
        height: auto;
        min-height: 1;
        max-height: 8;
        padding: 0;
        border: none;
        background: transparent;
    }
    #input-box:focus {
        background: transparent;
    }

    /* Hint bar - minimal keybinding hints */
    #hint-bar {
        height: 1;
        padding: 0 1;
        color: $text-muted;
        background: transparent;
    }

    /* User message - just text with subtle prefix */
    UserMessage {
        padding: 0;
        margin: 0 0 1 0;
        color: $text;
        background: transparent;
    }

    /* Agent message - clean, no borders */
    AgentMessage {
        padding: 0;
        margin: 0;
        background: transparent;
    }
    .agent-collapsible {
        padding: 0;
        margin: 0 0 1 0;
        background: transparent;
        border: none;
    }
    .agent-collapsible > CollapsibleTitle {
        color: $text-muted;
        padding: 0;
        background: transparent;
    }
    .agent-collapsible > Contents {
        padding: 0 0 0 2;
    }

    /* Spinner - prominent */
    #agent-spinner {
        width: auto;
        height: 1;
        margin: 0;
        color: $warning;
    }

    /* Tool execution - compact inline style */
    ToolExecution {
        margin: 0;
        padding: 0;
    }
    .tool-collapsible {
        background: transparent;
        border: none;
        padding: 0;
        margin: 0;
    }
    .tool-collapsible > CollapsibleTitle {
        color: $primary;
        padding: 0;
        background: transparent;
    }
    .tool-args {
        padding: 0 0 0 2;
        color: $text-muted;
    }
    .tool-result {
        padding: 0 0 0 2;
        color: $text-muted;
    }
    .completed .tool-result {
        color: $success;
    }

    /* Autocomplete - simple dropdown */
    PersonaAutocomplete {
        layer: above;
        dock: bottom;
        offset: 0 -2;
        height: auto;
        max-height: 8;
        background: $surface;
        border: solid $surface-lighten-1;
        padding: 0;
    }

    /* Help overlay - simple, no heavy borders */
    HelpOverlay {
        align: center middle;
        background: $background 80%;
    }
    #help-content {
        background: $surface;
        padding: 1 2;
        width: 45;
        height: auto;
    }

    /* File picker - minimal */
    FilePickerScreen {
        align: center middle;
        background: $background 80%;
    }
    #file-picker-label {
        padding: 0 1;
        color: $text;
    }
    #file-path-input {
        width: 50;
        margin: 1 0;
        border: solid $surface-lighten-1;
    }
    .error-message {
        color: $error;
        padding: 0 1;
        height: auto;
    }

    /* File attachments - subtle indicator */
    #attached-files {
        dock: bottom;
        height: auto;
        padding: 0 1;
        background: transparent;
    }
    .file-pills {
        color: $text-muted;
    }

    /* Task list - clean modal */
    TaskListScreen {
        align: center middle;
        background: $background 80%;
    }
    #task-list-title {
        color: $text-muted;
        padding: 0 1;
        width: 40;
    }
    #task-option-list {
        background: $surface;
        width: 40;
        height: auto;
        max-height: 8;
        border: solid $surface-lighten-1;
    }
    #task-list-help, #no-tasks-message {
        color: $text-muted;
        padding: 0 1;
        width: 40;
    }

    /* Diff screen - positioned at bottom so chat is visible above */
    DiffScreen {
        align: center bottom;
        background: $background 50%;
    }
    #diff-file-header {
        color: $text;
        padding: 0 1;
        width: 100%;
        background: $primary;
    }
    #diff-container {
        background: $surface;
        width: 100%;
        height: 15;
        padding: 1;
        border: solid $surface-lighten-1;
    }
    #diff-content {
        color: $text;
    }
    #diff-hints {
        width: 80;
        text-align: center;
        color: $text-muted;
        padding: 1 0;
    }
    """

    # Claude Code CLI parity keybindings
    BINDINGS = [
        Binding("ctrl+d", "quit", "Quit"),  # Claude Code uses Ctrl+D
        Binding("ctrl+c", "cancel_generation", "Cancel"),  # Claude Code uses Ctrl+C
        Binding("escape", "cancel_generation", "Cancel"),
        Binding("up", "history_up", "Previous", show=False),
        Binding("down", "history_down", "Next", show=False),
        Binding("question_mark", "show_help", "Help"),
        Binding("ctrl+slash", "show_help", "Help"),
        Binding(
            "ctrl+o", "toggle_collapse", "Collapse"
        ),  # Claude Code: toggleTranscript
        Binding("ctrl+b", "background_task", "Background"),  # Claude Code uses Ctrl+B
        Binding("ctrl+t", "show_tasks", "Tasks"),
        Binding("ctrl+s", "show_subagents", "Subagents"),  # Show running subagents
        Binding("a", "accept_all", "Accept All", show=False),
    ]

    def __init__(self):
        super().__init__()
        self.bridge = UnifiedAgentBridge()
        self.current_story = None
        self.current_agent_msg = None
        self.current_tool_msg = None
        self.accumulated_text = ""
        self.status_bar = None  # Reference to StatusBar widget
        # Test: token_display should be None initially
        self.token_display: TokenDisplay | None = (
            None  # Reference to TokenDisplay widget
        )
        # Test: current_worker should be None initially
        self.current_worker = None  # Reference to active worker thread
        # Test: command_history should be empty list initially
        # Test: history should be limited to 50 items to minimize memory
        self.command_history: list[str] = []  # Store previous commands (max 50)
        # Test: history_index should be -1 initially (no history navigation)
        self.history_index: int = -1  # Current position in history
        # Test: autocomplete should be None initially
        self.autocomplete: PersonaAutocomplete | None = (
            None  # Persona autocomplete widget
        )
        # Test: attached_files should be empty list initially
        # Test: attached_files should store absolute paths as strings
        self.attached_files: list[str] = []  # Store attached file paths
        # Test: file_attachment_widget should be None initially
        self.file_attachment_widget: FileAttachment | None = (
            None  # File attachment display widget
        )
        # Test: background_tasks should be empty list initially
        # Test: background_tasks should store BackgroundTask objects
        # Test: Should limit to 5 background tasks max to minimize memory
        self.background_tasks: list[
            BackgroundTask
        ] = []  # Store background tasks (max 5)
        # Test: task_counter should start at 0
        # Test: task_counter should increment for each new background task
        self.task_counter: int = 0  # Unique ID counter for background tasks
        # Test: pending_write should be None initially
        # Test: pending_write should store (file_path, old_content, new_content) tuple when write is pending
        self.pending_write: tuple[str, str, str] | None = (
            None  # Store pending file write operations (path, old_content, new_content)
        )
        # Test: pending_writes_queue should be empty list initially
        # Test: Stores list of (path, old_content, new_content) tuples for "Accept All" feature
        self.pending_writes_queue: list[tuple[str, str, str]] = []
        # Test: pending_edit should be None initially
        # Test: Stores (path, old_string, new_string) for technical edit approval
        self.pending_edit: tuple[str, str, str] | None = None

        # DevTime Manager
        self.dev_time_manager = (
            DevTimeManager() if HAS_DEVTIME and DevTimeManager else None
        )

    def compose(self) -> ComposeResult:
        # Claude Code style: no Header/Footer chrome, just content
        # Top status line (like Claude Code's "main > project > model")
        self.status_bar = StatusBar(self.bridge.provider)
        yield self.status_bar
        # Main chat area
        yield VerticalScroll(id="chat-scroll")
        # Activity Panel
        with Collapsible(
            title="Agent Activity", collapsed=True, id="activity-panel"
        ) as activity_collapsible:
            activity_collapsible.border_title = "Agent Activity"
            yield SubagentActivity()
        # Token display above input
        self.token_display = TokenDisplay(self.bridge.provider)
        yield self.token_display
        # Persona autocomplete (hidden by default)
        self.autocomplete = PersonaAutocomplete()
        yield self.autocomplete
        # File attachment display (hidden initially)
        self.file_attachment_widget = FileAttachment([])
        self.file_attachment_widget.display = False
        yield self.file_attachment_widget
        # Input section at bottom
        with Vertical(id="input-section"):
            # Input row: prompt + textarea
            with Horizontal(id="input-row"):
                yield Static("[bold cyan]>[/bold cyan] ", id="input-prompt")
                yield SubmitTextArea(id="input-box")
            # Minimal hint line (Claude Code style)
            yield Static(
                "[dim]^d[/dim] quit  [dim]?[/dim] help  [dim]esc[/dim] cancel",
                id="hint-bar",
            )

    def on_mount(self) -> None:
        # Claude Code style: minimal title in terminal tab
        self.title = "Agent"
        self.sub_title = ""  # No subtitle
        # Focus the input
        text_area = self.query_one("#input-box", TextArea)
        text_area.text = ""
        text_area.focus()
        # Set up periodic refresh for subagent count (every 2 seconds)
        if HAS_TELEMETRY and telemetry:
            # Clean up stale agents on startup (older than 1 hour)
            try:
                stale_count = telemetry.cleanup_stale_agents(max_age_hours=1)
                if stale_count > 0:
                    self.notify(
                        f"Cleaned up {stale_count} stale agent(s)", severity="warning"
                    )
            except Exception:
                pass
            self.set_interval(2.0, self.refresh_subagent_count)

        # DevTime: Check for active session or start new one
        if self.dev_time_manager:
            try:
                # Always show modal on startup (either to start new or recover existing)
                self.push_screen(
                    DevTimeModal(self.dev_time_manager), self.on_devtime_modal_result
                )

                # Set interval for session duration refresh (60s)
                self.set_interval(60.0, self.refresh_session_elapsed)
            except Exception as e:
                self.notify(f"DevTime error: {e}", severity="error")

    def on_devtime_modal_result(self, result: str | None) -> None:
        """Handle result from DevTimeModal."""
        if result == "restart":
            # Re-open modal
            self.push_screen(
                DevTimeModal(self.dev_time_manager), self.on_devtime_modal_result
            )
        elif result == "started" or result == "continue":
            self.refresh_session_elapsed()
        else:
            # Skip or dismissed
            if self.status_bar:
                self.status_bar.set_session_info("[dim]no session[/dim]")

    def refresh_session_elapsed(self) -> None:
        """Refresh the session elapsed time in status bar."""
        if not self.dev_time_manager or not self.status_bar:
            return

        if not self.dev_time_manager.is_active():
            return

        context = self.dev_time_manager.get_context()
        if not context:
            return

        elapsed = self.dev_time_manager.get_elapsed_seconds()
        h, r = divmod(int(elapsed), 3600)
        m = r // 60

        time_str = f"{h}h {m}m" if h > 0 else f"{m}m"

        entity = context.get("entity", "?")
        component = context.get("component", "?")
        phase = context.get("phase", "")

        # Capitalizable check
        is_cap = entity == "CORE" and phase == "APPLICATION_DEVELOPMENT"
        icon = "✅" if is_cap else "⬜"

        status_text = f"{entity}/{component} · {time_str} {icon}"
        self.status_bar.set_session_info(status_text)

    def action_quit(self) -> None:
        """Quit the application, checking for active dev session."""
        if self.dev_time_manager and self.dev_time_manager.is_active():
            self.push_screen(
                DevTimeCloseModal(self.dev_time_manager), self.on_close_modal_result
            )
        else:
            self.exit()

    def on_close_modal_result(self, result: str | None) -> None:
        """Handle result from DevTimeCloseModal."""
        if result == "quit":
            self.exit()

    def refresh_subagent_count(self) -> None:
        """Refresh the subagent count and details from telemetry."""
        if HAS_TELEMETRY and telemetry and self.status_bar:
            try:
                running = telemetry.get_running_agents()
                self.status_bar.set_subagent_count(len(running), running)
                # Post message to the activity widget
                self.query_one(SubagentActivity).post_message(
                    SubagentActivity.SubagentStatus(running)
                )
            except Exception:
                pass  # Silently ignore telemetry errors

    @on(TextArea.Changed)
    def on_text_changed(self, event: TextArea.Changed) -> None:
        """Handle text changes to show/hide autocomplete."""
        if event.text_area.id != "input-box":
            return

        text = event.text_area.text
        # Show autocomplete when text is exactly "/"
        if text == "/":
            self.show_autocomplete()
        # Hide autocomplete once user types more than just "/" or clears input
        elif self.autocomplete and str(self.autocomplete.styles.display) != "none":
            if text != "/":
                self.hide_autocomplete()

    @on(SubmitTextArea.Submitted)
    async def on_submit(self, _event: SubmitTextArea.Submitted) -> None:
        """Handle Enter key from input box."""
        await self.submit_command()

    @on(SubmitTextArea.HistoryUp)
    def on_history_up(self, _event: SubmitTextArea.HistoryUp) -> None:
        """Handle Up arrow for history navigation."""
        self.action_history_up()

    @on(SubmitTextArea.HistoryDown)
    def on_history_down(self, _event: SubmitTextArea.HistoryDown) -> None:
        """Handle Down arrow for history navigation."""
        self.action_history_down()

    @on(SubmitTextArea.ScrollUp)
    def on_scroll_up(self, _event: SubmitTextArea.ScrollUp) -> None:
        """Handle PageUp to scroll chat."""
        scroll = self.query_one("#chat-scroll", VerticalScroll)
        scroll.scroll_page_up(animate=False)

    @on(SubmitTextArea.ScrollDown)
    def on_scroll_down(self, _event: SubmitTextArea.ScrollDown) -> None:
        """Handle PageDown to scroll chat."""
        scroll = self.query_one("#chat-scroll", VerticalScroll)
        scroll.scroll_page_down(animate=False)

    @on(SubmitTextArea.LineScrollUp)
    def on_line_scroll_up(self, _event: SubmitTextArea.LineScrollUp) -> None:
        """Handle Up arrow to scroll chat line-by-line."""
        scroll = self.query_one("#chat-scroll", VerticalScroll)
        scroll.scroll_up(animate=False)
        scroll.scroll_up(animate=False)  # Scroll faster (2 lines)

    @on(SubmitTextArea.LineScrollDown)
    def on_line_scroll_down(self, _event: SubmitTextArea.LineScrollDown) -> None:
        """Handle Down arrow to scroll chat line-by-line."""
        scroll = self.query_one("#chat-scroll", VerticalScroll)
        scroll.scroll_down(animate=False)
        scroll.scroll_down(animate=False)  # Scroll faster (2 lines)

    @on(Key)
    async def on_key(self, event: Key) -> None:
        """Handle key events for escape and other shortcuts."""
        # Escape should hide autocomplete if visible
        if (
            event.key == "escape"
            and self.autocomplete
            and str(self.autocomplete.styles.display) != "none"
        ):
            event.prevent_default()
            event.stop()
            self.hide_autocomplete()
            return

    async def submit_command(self) -> None:
        """Submit the command from the TextArea."""
        # Test: submit_command should read from TextArea, not Input
        # Test: Empty commands should be ignored
        # Test: Command should be added to history after submission
        # Test: History list should not exceed 50 items
        # Test: history_index should be reset to -1 after submission
        # Test: Should include attached file contents in the prompt context
        # Test: Should clear attached files after submission
        text_area = self.query_one("#input-box", TextArea)
        cmd = text_area.text.strip()
        if not cmd:
            return

        # Add to history (limit to 50 items)
        self.command_history.append(cmd)
        if len(self.command_history) > 50:
            self.command_history.pop(0)
        self.history_index = -1  # Reset history navigation

        # Handle /provider command
        if cmd.lower().startswith("/provider"):
            parts = cmd.split()
            scroll = self.query_one("#chat-scroll", VerticalScroll)

            if len(parts) == 2 and parts[1].lower() in [
                "ollama",
                "gemini",
                "openrouter",
            ]:
                new_provider = parts[1].lower()
                os.environ["AGENT_PROVIDER"] = new_provider
                self.bridge = UnifiedAgentBridge()

                # Update UI
                if self.status_bar:
                    self.status_bar.provider = new_provider
                    self.status_bar.update(self.status_bar.compose_status_text())
                if self.token_display:
                    self.token_display.provider = new_provider
                    self.token_display.update(self.token_display.compose_display_text())

                await scroll.mount(UserMessage(cmd))
                await scroll.mount(
                    Static(
                        f"\n[green]✓ Switched provider to {new_provider.upper()}[/green]\n"
                    )
                )
            else:
                await scroll.mount(UserMessage(cmd))
                await scroll.mount(
                    Static(
                        "\n[yellow]Usage: /provider [ollama|gemini|openrouter][/yellow]\n"
                    )
                )

            scroll.scroll_end(animate=False)
            text_area.clear()
            return

        # Handle /cleanup command
        if cmd.lower() == "/cleanup":
            self._run_cleanup()
            text_area.clear()
            return

        # Handle /model command
        if cmd.lower().startswith("/model"):
            parts = cmd.split()
            scroll = self.query_one("#chat-scroll", VerticalScroll)

            if len(parts) == 2:
                new_model = parts[1]
                os.environ["OPENROUTER_MODEL"] = new_model
                await scroll.mount(UserMessage(cmd))
                await scroll.mount(
                    Static(f"\n[green]✓ OpenRouter model set to: {new_model}[/green]\n")
                )
            else:
                current = os.getenv(
                    "OPENROUTER_MODEL", "arcee-ai/trinity-large-preview:free"
                )
                await scroll.mount(UserMessage(cmd))
                await scroll.mount(
                    Static(
                        f"\n[yellow]Current OpenRouter model: {current}[/yellow]\n[dim]Usage: /model <model_name>[/dim]\n"
                    )
                )

            scroll.scroll_end(animate=False)
            text_area.clear()
            return

        # Handle /use command
        if cmd.lower().startswith("/use"):
            parts = cmd.split()
            scroll = self.query_one("#chat-scroll", VerticalScroll)

            if len(parts) == 2:
                arg = parts[1]
                story_dir = "docs/dev/stories"
                target = arg
                # Auto-complete path if just filename given
                if not os.path.exists(target) and os.path.exists(
                    os.path.join(story_dir, arg)
                ):
                    target = os.path.join(story_dir, arg)

                if os.path.exists(target):
                    self.update_status(story=target)
                    await scroll.mount(UserMessage(cmd))
                    await scroll.mount(
                        Static(f"\n[green]✓ Context set to: {target}[/green]\n")
                    )
                else:
                    # List available stories to help user
                    msg = f"\n[red]✗ File not found: {arg}[/red]\n"
                    if os.path.exists(story_dir):
                        stories = sorted(
                            [f for f in os.listdir(story_dir) if f.endswith(".md")]
                        )
                        if stories:
                            msg += (
                                "\n[dim]Available stories:[/dim]\n"
                                + "\n".join([f"  {s}" for s in stories])
                                + "\n"
                            )
                    await scroll.mount(UserMessage(cmd))
                    await scroll.mount(Static(msg))
            else:
                msg = "\n[yellow]Usage: /use <story_filename>[/yellow]\n"
                if os.path.exists("docs/dev/stories"):
                    stories = sorted(
                        [f for f in os.listdir("docs/dev/stories") if f.endswith(".md")]
                    )
                    if stories:
                        msg += (
                            "\n[dim]Available stories:[/dim]\n"
                            + "\n".join([f"  {s}" for s in stories])
                            + "\n"
                        )
                await scroll.mount(UserMessage(cmd))
                await scroll.mount(Static(msg))

            scroll.scroll_end(animate=False)
            text_area.clear()
            return

        # Build command with file attachments
        full_cmd = cmd
        if self.attached_files:
            # Test: File contents should be prefixed with "Context files:" header
            # Test: Each file should be labeled with its path
            # Test: Files that can't be read should show error message
            file_context = "\n\nContext files:\n"
            for file_path in self.attached_files:
                try:
                    with open(file_path, "r", encoding="utf-8") as f:
                        content = f.read()
                        file_context += f"\n--- {file_path} ---\n{content}\n"
                except Exception as e:
                    file_context += f"\n--- {file_path} ---\nError reading file: {e}\n"

            full_cmd = file_context + "\n" + cmd

        text_area.clear()
        if cmd.lower() in ["exit", "quit"]:
            self.exit()
            return

        scroll = self.query_one("#chat-scroll", VerticalScroll)

        # Show user message with file attachment indicator if files attached
        user_msg_text = cmd
        if self.attached_files:
            file_list = ", ".join([Path(f).name for f in self.attached_files])
            user_msg_text += f"\n  [dim]attached: {file_list}[/dim]"

        await scroll.mount(UserMessage(user_msg_text))
        scroll.scroll_end(animate=False)

        # Clear attachments after use
        self.attached_files = []
        self.update_file_attachment_display()

        # Prepare Agent Message
        parts = cmd.split(" ", 1)
        persona = parts[0] if cmd.startswith("/") else "Agent"
        query_preview = (
            parts[1][:30] + "..."
            if len(parts) > 1 and len(parts[1]) > 30
            else (parts[1] if len(parts) > 1 else "")
        )

        # Collapse previous agent messages to reduce clutter (keep last 2 expanded)
        # Test: Previous agent messages should be collapsed when new one is created
        # Fix Pi Constraint: Use list comprehension instead of explicit list() conversion
        agent_messages = [msg for msg in scroll.query("AgentMessage")]
        if len(agent_messages) >= 2:
            for msg in agent_messages[:-1]:  # Collapse all but the most recent
                if isinstance(msg, AgentMessage):
                    msg.collapse_message()

        self.current_agent_msg = AgentMessage(persona, self.bridge.provider)
        self.accumulated_text = ""
        await scroll.mount(self.current_agent_msg)

        # Test: current_worker should be set when starting agent worker
        # Test: full_cmd (with file context) should be passed to worker, not cmd
        # Build task description for status bar (persona: query_preview)
        task_desc = f"{persona}: {query_preview}" if query_preview else persona
        self.set_working_state(True, task_desc)
        self.current_worker = self.run_agent_worker(full_cmd)

    # Run in a thread to prevent blocking the UI during subprocess calls
    @work(exclusive=True, thread=True)
    def run_agent_worker(self, command):
        try:
            self.bridge.execute(
                command,
                self.current_story,
                stream_callback=self.handle_stream,
                tool_callback=self.handle_tool,
            )
        finally:
            # Always mark as done, even on error
            self.call_from_thread(self.set_working_state, False)
        # Test: After response completes, should estimate tokens and update display
        # Test: Token estimation should use accumulated_text length
        # Test: Should handle case where token_display is None
        self.call_from_thread(self.update_token_count)

    def estimate_tokens(self, text: str) -> int:
        """Estimate token count from text using rough char-to-token ratio.

        Test: Empty string should return 0
        Test: Should use ratio of 4 characters per token (rough estimate)
        Test: "Hello world" (11 chars) should return ~3 tokens
        Test: Should handle None gracefully and return 0
        """
        if not text:
            return 0
        # Rough estimate: 1 token ≈ 4 characters (standard for English text)
        return len(text) // 4

    def update_token_count(self) -> None:
        """Update the token display with estimated token count from current response.

        Test: Should estimate tokens from accumulated_text
        Test: Should call token_display.update_tokens() if token_display exists
        Test: Should handle case where token_display is None gracefully
        """
        if not self.token_display:
            return

        tokens = self.estimate_tokens(self.accumulated_text)
        self.token_display.update_tokens(tokens)

    def handle_stream(self, text):
        """Callback for LLM text generation."""
        if self.current_agent_msg:
            self.accumulated_text += text
            # Schedule update on main thread
            self.call_from_thread(
                self.current_agent_msg.update_text, self.accumulated_text
            )
            self.call_from_thread(self.scroll_to_bottom)

    def handle_tool(self, event_type, data):
        """Callback for tool execution events.

        Returns False for write_file/edit_file to indicate TUI will handle the operation.
        """
        if event_type == "write_file":
            # Return False to indicate we'll handle the write in the UI
            self.call_from_thread(self._handle_tool_ui, event_type, data)
            return False
        elif event_type == "edit_file":
            # Return False to indicate we'll handle the edit in the UI
            self.call_from_thread(self._handle_tool_ui, event_type, data)
            return False
        elif event_type == "exec_command":
            # Return False to indicate we'll handle the command in the UI
            self.call_from_thread(self._handle_tool_ui, event_type, data)
            return False
        else:
            self.call_from_thread(self._handle_tool_ui, event_type, data)

    def _handle_tool_ui(self, event_type, data):
        """Handle tool execution UI updates.

        Test: Should intercept write_file events and show diff screen
        Test: Should intercept edit_file events and show technical edit diff
        Test: Should read existing file content if it exists
        Test: Should handle new files (no existing content)
        Test: Should only write/edit file if diff is accepted
        Test: Should show tool execution widget for exec_command
        Test: Should update tool result on "result" event
        """
        if not self.current_agent_msg:
            self.notify(
                f"Tool {event_type} received but no agent_msg!", severity="warning"
            )
            return

        if event_type == "write_file":
            # write_file is for NEW files only
            if isinstance(data, dict) and "path" in data and "content" in data:
                file_path = data["path"]
                new_content = data["content"]
                self._show_diff_and_write(file_path, new_content)
            else:
                self.current_tool_msg = ToolExecution(event_type, str(data))
                self.current_agent_msg.mount(self.current_tool_msg)
        elif event_type == "edit_file":
            # edit_file is for technical edits to existing files
            if isinstance(data, dict) and all(
                k in data for k in ("path", "old_string", "new_string")
            ):
                self._show_edit_diff(
                    data["path"], data["old_string"], data["new_string"]
                )
            else:
                self.current_tool_msg = ToolExecution(event_type, str(data))
                self.current_agent_msg.mount(self.current_tool_msg)
        elif event_type == "exec_command":
            # Show confirmation screen
            self._show_command_confirmation(data)
        elif event_type == "result":
            if self.current_tool_msg:
                self.current_tool_msg.update_result(data)
                # Reset for next tool
                self.current_tool_msg = None

        self.scroll_to_bottom()

    def _show_diff_and_write(self, file_path: str, new_content: str) -> None:
        """Show inline diff and write file if accepted."""
        old_content = ""
        path = Path(file_path)
        if path.exists():
            try:
                with open(path, "r", encoding="utf-8") as f:
                    old_content = f.read()
            except Exception as e:
                old_content = f"[Error reading file: {e}]"

        self.pending_write = (file_path, old_content, new_content)
        self.queue_pending_write(file_path, old_content, new_content)

        self.current_tool_msg = ToolExecution("write_file", file_path)
        if self.current_agent_msg:
            self.current_agent_msg.mount(self.current_tool_msg)

        diff_viewer = InlineDiffViewer(file_path, old_content, new_content)
        self.query_one("#chat-scroll").mount(diff_viewer)
        self.scroll_to_bottom()

    @on(InlineDiffViewer.DiffReviewed)
    def on_diff_reviewed(self, message: InlineDiffViewer.DiffReviewed) -> None:
        """Handle the response from an inline diff viewer for both write and edit."""
        if self.pending_edit:
            self._on_edit_response(message.accepted)
        elif self.pending_write:
            self._on_diff_response(message.accepted)

    def _show_command_confirmation(self, command: str) -> None:
        """Show an inline confirmation for shell commands."""
        # Show pending tool widget so user can see what's awaiting approval
        self.current_tool_msg = ToolExecution("exec_command", command)
        if self.current_agent_msg:
            self.current_agent_msg.mount(self.current_tool_msg)

        # Mount the inline confirmation widget
        confirmation_widget = InlineConfirmation(command)
        self.query_one("#chat-scroll").mount(confirmation_widget)
        self.scroll_to_bottom()

    @on(InlineConfirmation.Confirmed)
    def on_inline_confirmation(self, message: InlineConfirmation.Confirmed) -> None:
        """Handle the response from an inline confirmation."""
        self._execute_command(message.command, message.accepted)

    def _calculate_change_stats(
        self, old_content: str, new_content: str
    ) -> tuple[int, int]:
        """Calculate additions and deletions between old and new content.

        Test: Should return (additions, deletions) tuple
        Test: Empty old_content should count all new lines as additions
        """
        old_lines = old_content.splitlines(keepends=True) if old_content else []
        new_lines = new_content.splitlines(keepends=True)

        diff_lines = [
            line for line in difflib.unified_diff(old_lines, new_lines, lineterm="")
        ]

        additions = sum(
            1
            for line in diff_lines
            if line.startswith("+") and not line.startswith("+++")
        )
        deletions = sum(
            1
            for line in diff_lines
            if line.startswith("-") and not line.startswith("---")
        )
        return additions, deletions

    def _on_diff_response(self, accepted: bool | None) -> None:
        """Handle diff screen response.

        Test: Should write file if accepted is True
        Test: Should skip write if accepted is False or None
        Test: Should show tool execution widget with result
        Test: Should clear pending_write after handling
        Test: Should update status bar with file change stats when accepted
        Test: Should remove item from pending_writes_queue to avoid double-processing
        """
        if not self.pending_write:
            return

        file_path, old_content, new_content = self.pending_write
        self.pending_write = None

        # Remove from Accept All queue (processed individually)
        self.pending_writes_queue = [
            (p, o, n) for p, o, n in self.pending_writes_queue if p != file_path
        ]

        # Tool widget was already created in _show_diff_and_write, just update result

        if accepted is True:
            # Write the file
            try:
                result = self.bridge.tool_executor.write_file(
                    file_path, new_content, confirm=False
                )
                # Update status bar with file change stats
                additions, deletions = self._calculate_change_stats(
                    old_content, new_content
                )
                if self.status_bar:
                    self.status_bar.update_status(file_change=(additions, deletions))
            except Exception as e:
                result = f"✗ Error writing file: {e}"
        else:
            result = "✗ Write rejected by user"

        # Update tool result
        if self.current_tool_msg:
            self.current_tool_msg.update_result(result)
            self.current_tool_msg = None

        self.scroll_to_bottom()

    def _run_cleanup(self) -> None:
        """Run the cleanup logic to remove stale agents."""
        if HAS_TELEMETRY and telemetry:
            try:
                # Mark all RUNNING agents as STALE
                conn = telemetry._connect()
                try:
                    cursor = conn.execute(
                        "UPDATE agents SET status = 'STALE', updated_at = datetime('now') "
                        "WHERE status = 'RUNNING'"
                    )
                    cleaned = cursor.rowcount
                    conn.commit()
                finally:
                    conn.close()

                # Refresh the status bar
                self.refresh_subagent_count()
                self.notify(
                    f"Cleaned up {cleaned} stale agent(s)", severity="information"
                )
            except Exception as e:
                self.notify(f"Cleanup failed: {e}", severity="error")
        else:
            self.notify("Telemetry not available", severity="warning")

    @work(exclusive=True, thread=True)
    def _execute_command_worker(self, command: str) -> None:
        """Execute command in background and stream output."""
        try:
            process = subprocess.Popen(
                command,
                shell=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1,
            )

            output_acc = ""
            if process.stdout:
                for line in process.stdout:
                    output_acc += line
                    self.call_from_thread(self._update_command_output, output_acc)

            process.wait()
            result = output_acc
            if process.returncode != 0:
                result = f"✗ Exit code {process.returncode}\n{result}"

        except Exception as e:
            result = f"Error executing command: {e}"

        self.call_from_thread(self._finish_command_execution, result)

    def _update_command_output(self, text: str) -> None:
        """Update the tool widget with streaming output."""
        if self.current_tool_msg:
            self.current_tool_msg.result_widget.update(text)
            self.scroll_to_bottom()

    def _execute_command(self, command: str, accepted: bool | None) -> None:
        """Execute a command after user confirmation."""
        if accepted is True:
            # Execute command (bypass console confirmation)
            self.notify(f"Executing: {command[:50]}...", severity="information")
            self._execute_command_worker(command)
        else:
            result = "✗ Execution cancelled by user"
            self._finish_command_execution(result)

    def _finish_command_execution(self, result: str) -> None:
        """Finalize command execution and update UI."""
        self.notify(f"Done: {result[:80]}...", severity="information")

        # Update tool widget result
        if self.current_tool_msg:
            self.current_tool_msg.update_result(result)
            self.current_tool_msg = None

        self.scroll_to_bottom()

    def _show_edit_diff(self, file_path: str, old_string: str, new_string: str) -> None:
        """Show an inline diff for a technical edit and apply if accepted."""
        self.pending_edit = (file_path, old_string, new_string)

        self.current_tool_msg = ToolExecution("edit_file", file_path)
        if self.current_agent_msg:
            self.current_agent_msg.mount(self.current_tool_msg)

        diff_viewer = InlineDiffViewer(file_path, old_string, new_string)
        self.query_one("#chat-scroll").mount(diff_viewer)
        self.scroll_to_bottom()

    def _on_edit_response(self, accepted: bool | None) -> None:
        """Handle edit diff screen response.

        Test: Should apply edit if accepted is True
        Test: Should skip edit if accepted is False or None
        Test: Should show tool execution widget with result
        Test: Should clear pending_edit after handling
        """
        if not self.pending_edit:
            return

        file_path, old_string, new_string = self.pending_edit
        self.pending_edit = None

        # Tool widget was already created in _show_edit_diff, just update result

        if accepted is True:
            # Apply the technical edit (bypass console confirmation)
            result = self.bridge.tool_executor.edit_file(
                file_path, old_string, new_string, confirm=False
            )
            # Update status bar with change stats
            if self.status_bar:
                additions = len(new_string.splitlines())
                deletions = len(old_string.splitlines())
                self.status_bar.update_status(file_change=(additions, deletions))
        else:
            result = "✗ Edit rejected by user"

        # Update tool result
        if self.current_tool_msg:
            self.current_tool_msg.update_result(result)
            self.current_tool_msg = None

        self.scroll_to_bottom()

    def scroll_to_bottom(self):
        self.query_one("#chat-scroll", VerticalScroll).scroll_end(animate=False)

    def update_status(self, story: str | None = None, task_count: int | None = None):
        """Update the status bar with new story information and/or task count."""
        # Test: Calling update_status should update status_bar widget
        # Test: Should handle case where status_bar is None gracefully
        # Test: Should pass task_count to status_bar if provided
        if self.status_bar:
            self.status_bar.update_status(story=story, task_count=task_count)
        if story is not None:
            self.current_story = story

    def set_working_state(self, working: bool, task: str = "") -> None:
        """Set the working state indicator in the status bar and hint bar.

        Args:
            working: Whether the agent is currently working
            task: Description of current task (e.g., "architect: review code")
        """
        if self.status_bar:
            self.status_bar.set_working(working, task)
        # Update hint bar to show working status
        try:
            hint_bar = self.query_one("#hint-bar", Static)
            if working:
                hint_bar.update(
                    f"[yellow bold]● WORKING[/yellow bold] {task}  [dim]esc[/dim] cancel"
                )
            else:
                hint_bar.update(
                    "[dim]^d[/dim] quit  [dim]?[/dim] help  [dim]esc[/dim] cancel"
                )
        except Exception:
            pass

    def action_cancel_generation(self) -> None:
        """Cancel the current agent generation (Escape key)."""
        # Test: Should do nothing if no worker is running
        # Test: Should call worker.cancel() if worker exists
        # Test: Should update agent message to show "Cancelled"
        # Test: Should reset current_worker to None
        if self.current_worker is not None:
            self.current_worker.cancel()
            if self.current_agent_msg:
                self.accumulated_text += "\n\n**[Cancelled]**"
                self.current_agent_msg.update_text(self.accumulated_text)
            self.current_worker = None
            self.set_working_state(False)

    def action_show_help(self) -> None:
        """Show the help overlay with keyboard shortcuts (? or Ctrl+/)."""
        # Test: Should push HelpOverlay screen
        # Test: Should display all keyboard shortcuts
        # Test: HelpOverlay should be centered and modal
        self.push_screen(HelpOverlay())

    def action_toggle_collapse(self) -> None:
        """Toggle collapse/expand all agent messages (Ctrl+O - Claude Code parity).

        Test: Should collapse all messages if any are expanded
        Test: Should expand all messages if all are collapsed
        Test: Should toggle the all_collapsed state
        """
        scroll = self.query_one("#chat-scroll", VerticalScroll)
        agent_messages = [msg for msg in scroll.query("AgentMessage")]

        if not agent_messages:
            return

        # Check if any are expanded (not collapsed)
        any_expanded = any(
            isinstance(msg, AgentMessage)
            and msg.collapsible
            and not msg.collapsible.collapsed
            for msg in agent_messages
        )

        # If any expanded, collapse all; otherwise expand all
        for msg in agent_messages:
            if isinstance(msg, AgentMessage):
                if any_expanded:
                    msg.collapse_message()
                else:
                    msg.expand_message()

    def action_history_up(self) -> None:
        """Navigate to previous command in history (Up arrow)."""
        # Test: Should do nothing if history is empty
        # Test: Should not go beyond the oldest command (index 0)
        # Test: Should populate TextArea with historical command
        # Test: history_index should increment up to len(history)-1
        if not self.command_history:
            return

        text_area = self.query_one("#input-box", TextArea)

        # First time pressing up, start from the end
        if self.history_index == -1:
            self.history_index = len(self.command_history) - 1
        elif self.history_index > 0:
            self.history_index -= 1

        text_area.text = self.command_history[self.history_index]

    def action_history_down(self) -> None:
        """Navigate to next command in history (Down arrow)."""
        # Test: Should do nothing if history_index is -1 (not navigating)
        # Test: Should move toward more recent commands
        # Test: Should clear TextArea when reaching the end (index -1)
        # Test: history_index should decrement down to -1
        if self.history_index == -1:
            return

        text_area = self.query_one("#input-box", TextArea)

        self.history_index += 1
        if self.history_index >= len(self.command_history):
            # Reached the end, clear input
            self.history_index = -1
            text_area.clear()
        else:
            text_area.text = self.command_history[self.history_index]

    def show_autocomplete(self) -> None:
        """Show the persona autocomplete dropdown.

        Test: Should populate autocomplete with persona names from bridge
        Test: Should make autocomplete visible
        Test: Keep focus on TextArea so user can continue typing
        """
        if not self.autocomplete:
            return

        # Populate with persona names
        personas = sorted(self.bridge.persona_files.keys())
        self.autocomplete.clear_options()
        for persona in personas:
            self.autocomplete.add_option(Option(f"/{persona}", id=persona))

        # Show but DON'T focus - let user keep typing in TextArea
        self.autocomplete.styles.display = "block"

    def hide_autocomplete(self) -> None:
        """Hide the persona autocomplete dropdown.

        Test: Should hide the autocomplete widget
        Test: Should return focus to TextArea
        """
        if not self.autocomplete:
            return

        self.autocomplete.styles.display = "none"
        text_area = self.query_one("#input-box", TextArea)
        text_area.focus()

    @on(OptionList.OptionSelected)
    def on_option_selected(self, event: OptionList.OptionSelected) -> None:
        """Handle persona selection from autocomplete.

        Test: Should insert selected persona into TextArea
        Test: Should hide autocomplete after selection
        Test: Should add trailing space after persona name
        Test: Should clear the "/" character before insertion
        """
        if event.option_list != self.autocomplete:
            return

        text_area = self.query_one("#input-box", TextArea)
        # Replace "/" with "/persona "
        text_area.clear()
        text_area.insert(f"/{event.option.id} ")
        self.hide_autocomplete()

    def action_open_file(self) -> None:
        """Open file picker to attach files (Ctrl+O).

        Test: Should push FilePickerScreen modal
        Test: Should handle file selection callback
        Test: Should add selected file to attached_files list
        Test: Should update file attachment display
        Test: Should ignore None result (cancelled)
        """
        self.push_screen(FilePickerScreen(), self.on_file_selected)

    def on_file_selected(self, file_path: str | None) -> None:
        """Handle file selection from file picker.

        Test: Should ignore None (cancelled selection)
        Test: Should add valid file path to attached_files
        Test: Should not add duplicate files
        Test: Should update file attachment display after adding
        Test: Should show file attachment widget if it was hidden
        """
        if file_path is None:
            return

        # Avoid duplicates
        if file_path not in self.attached_files:
            self.attached_files.append(file_path)
            self.update_file_attachment_display()

    def update_file_attachment_display(self) -> None:
        """Update the file attachment widget to show current attached files.

        Test: Should hide widget when attached_files is empty
        Test: Should show widget when attached_files has items
        Test: Should remount widget with new file list
        Test: file_attachment_widget should be updated, not recreated
        """
        if not self.file_attachment_widget:
            return

        if not self.attached_files:
            self.file_attachment_widget.display = False
        else:
            # Remove old widget and mount new one with updated files
            self.file_attachment_widget.remove()
            self.file_attachment_widget = FileAttachment(self.attached_files)
            # Mount before TextArea (which is docked to bottom)
            text_area = self.query_one("#input-box", TextArea)
            self.mount(self.file_attachment_widget, before=text_area)

    def action_background_task(self) -> None:
        """Background the current running task (Ctrl+\\).

        Test: Should do nothing if no task is currently running
        Test: Should do nothing if current_agent_msg is None
        Test: Should create BackgroundTask with current state
        Test: Should add task to background_tasks list
        Test: Should increment task_counter for unique ID
        Test: Should enforce max 5 background tasks (remove oldest if full)
        Test: Should clear current UI state (agent_msg, worker, accumulated_text)
        Test: Should update status bar with task count
        Test: Should focus input for new command
        """
        # Can only background if there's an active task
        if not self.current_agent_msg or not self.current_worker:
            return

        # Get the command from the most recent UserMessage
        # For simplicity, we'll store a placeholder command
        # In a full implementation, we'd track the original command
        text_area = self.query_one("#input-box", TextArea)
        cmd = text_area.text.strip() if text_area.text else "Background task"

        # Create background task
        task = BackgroundTask(
            id=self.task_counter,
            command=cmd if cmd else f"Task {self.task_counter}",
            agent_msg=self.current_agent_msg,
            accumulated_text=self.accumulated_text,
            worker=self.current_worker,
        )
        self.task_counter += 1

        # Add to list (enforce max 5 tasks)
        self.background_tasks.append(task)
        if len(self.background_tasks) > 5:
            # Remove oldest task
            old_task = self.background_tasks.pop(0)
            # Cancel the old task worker if still running
            if old_task.worker:
                old_task.worker.cancel()

        # Clear current state
        self.current_agent_msg = None
        self.current_worker = None
        self.accumulated_text = ""

        # Update status bar
        if self.status_bar:
            self.status_bar.update_status(task_count=len(self.background_tasks))

        # Clear input and focus for new command
        text_area.clear()
        text_area.focus()

    def action_show_tasks(self) -> None:
        """Show the background tasks list (Ctrl+T).

        Test: Should push TaskListScreen modal
        Test: Should pass current background_tasks to modal
        Test: Should handle task selection callback
        Test: Should restore selected task to foreground
        Test: Should do nothing if result is None (cancelled)
        """
        self.push_screen(TaskListScreen(self.background_tasks), self.on_task_selected)

    def action_show_subagents(self) -> None:
        """Show detailed status of running subagents (Ctrl+S).

        Test: Should push SubagentStatusScreen modal
        Test: Should pass current running agents from telemetry
        Test: Should work even if no subagents are running
        """
        agents = []
        if HAS_TELEMETRY and telemetry:
            try:
                agents = telemetry.get_running_agents()
            except Exception:
                pass
        self.push_screen(SubagentStatusScreen(agents), self._on_subagent_screen_dismiss)

    def _on_subagent_screen_dismiss(self, result: str | None) -> None:
        """Handle dismissal of subagent screen."""
        if result == "cleanup":
            self._run_cleanup()

    def on_task_selected(self, task_id: int | None) -> None:
        """Handle task selection from task list screen.

        Test: Should ignore None (cancelled)
        Test: Should find task by ID in background_tasks
        Test: Should call restore_task with task ID
        Test: Should handle case where task ID doesn't exist
        """
        if task_id is None:
            return

        # Find task by ID
        task = next((t for t in self.background_tasks if t.id == task_id), None)
        if task:
            self.restore_task(task_id)

    def restore_task(self, task_id: int) -> None:
        """Restore a background task to the foreground.

        Test: Should find task by ID in background_tasks
        Test: Should restore agent_msg, accumulated_text, worker to current state
        Test: Should remove task from background_tasks list
        Test: Should update status bar with new task count
        Test: Should scroll to the restored agent message
        Test: Should handle case where task is not found
        """
        # Find and remove task from background list
        task = next((t for t in self.background_tasks if t.id == task_id), None)
        if not task:
            return

        self.background_tasks.remove(task)

        # Restore task state
        self.current_agent_msg = task.agent_msg
        self.accumulated_text = task.accumulated_text
        self.current_worker = task.worker

        # Update status bar
        if self.status_bar:
            self.status_bar.update_status(task_count=len(self.background_tasks))

        # Scroll to the restored message
        self.scroll_to_bottom()

    def action_accept_all(self) -> None:
        """Accept all pending file writes in the queue (a key).

        Test: Should do nothing if pending_writes_queue is empty
        Test: Should process all writes in the queue sequentially
        Test: Should update status bar with total file changes
        Test: Should clear the queue after processing
        Test: Should show a summary message with count of accepted files
        """
        if not self.pending_writes_queue:
            return

        accepted_count = 0
        total_additions = 0
        total_deletions = 0

        for file_path, old_content, new_content in self.pending_writes_queue:
            try:
                # Write the file
                self.bridge.tool_executor.write_file(
                    file_path, new_content, confirm=False
                )
                accepted_count += 1

                # Calculate stats
                additions, deletions = self._calculate_change_stats(
                    old_content, new_content
                )
                total_additions += additions
                total_deletions += deletions

                # Update status bar incrementally
                if self.status_bar:
                    self.status_bar.update_status(file_change=(additions, deletions))

                # Show tool execution widget for each file
                tool_msg = ToolExecution("write_file", file_path)
                if self.current_agent_msg:
                    self.current_agent_msg.mount(tool_msg)
                    tool_msg.update_result(f"✓ Accepted (+{additions} -{deletions})")

            except Exception as e:
                # Show error for failed writes
                tool_msg = ToolExecution("write_file", file_path)
                if self.current_agent_msg:
                    self.current_agent_msg.mount(tool_msg)
                    tool_msg.update_result(f"✗ Error: {e}")

        # Clear the queue
        self.pending_writes_queue = []

        # Scroll to show results
        self.scroll_to_bottom()

    def queue_pending_write(
        self, file_path: str, old_content: str, new_content: str
    ) -> None:
        """Add a file write to the pending queue for Accept All feature.

        Test: Should append (path, old, new) tuple to pending_writes_queue
        """
        self.pending_writes_queue.append((file_path, old_content, new_content))


if __name__ == "__main__":
    AgentTui().run()
