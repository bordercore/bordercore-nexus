"""Bordercore Rich Dashboard

This script provides a terminal-based dashboard using Rich to display data
from Bordercore's REST API. It includes panels for bookmarks, todo items,
and site statistics, all updated at regular intervals.

Run with:
    $ DRF_TOKEN=$DRF_TOKEN_JERRELL python3 ./rich-dashboard.py
"""

import os
import queue
import subprocess
import sys
import termios
import threading
import time
import tty
from itertools import cycle
from typing import Any

import requests
from github_sample import GitHubCodeSampler
from requests import Response, Session
from rich import box
from rich.color import Color, parse_rgb_hex
from rich.console import Console, Group
from rich.layout import Layout
from rich.live import Live
from rich.panel import Panel
from rich.style import Style
from rich.syntax import Syntax
from rich.table import Table
from rich.text import Text
from bordercore.lib.scrollable_panel import ScrollablePanel

CODE_ECHOES_MAX_LINES = 200

BOOKMARKS_URL = "https://www.bordercore.com/api/bookmarks/?ordering=-created"
TODOS_URL = "https://www.bordercore.com/api/todos/?priority=1"
STATS_URL = "https://www.bordercore.com/api/site/stats"


class KeyReader:
    """Reads keyboard input in a background thread using cbreak mode.

    Parses escape sequences for arrow keys and Page Up/Down, and puts
    key names into a queue for non-blocking consumption by the main loop.
    """

    # Escape sequences for special keys
    _ESCAPE_SEQUENCES = {
        "[A": "up",
        "[B": "down",
        "[5~": "page_up",
        "[6~": "page_down",
    }

    def __init__(self) -> None:
        self._queue: queue.Queue[str] = queue.Queue()
        self._running = False
        self._thread: threading.Thread | None = None
        self._old_settings: list | None = None

    def start(self) -> None:
        """Start reading keys in a background daemon thread."""
        if self._running:
            return
        self._old_settings = termios.tcgetattr(sys.stdin)
        tty.setcbreak(sys.stdin.fileno())
        self._running = True
        self._thread = threading.Thread(target=self._read_loop, daemon=True)
        self._thread.start()

    def stop(self) -> None:
        """Stop reading and restore terminal settings."""
        self._running = False
        if self._old_settings is not None:
            termios.tcsetattr(sys.stdin, termios.TCSADRAIN, self._old_settings)
            self._old_settings = None

    def get_key(self) -> str | None:
        """Return the next key name or None if the queue is empty."""
        try:
            return self._queue.get_nowait()
        except queue.Empty:
            return None

    def _read_loop(self) -> None:
        """Background loop that reads stdin and enqueues key names."""
        while self._running:
            try:
                ch = sys.stdin.read(1)
                if not ch:
                    continue

                if ch == "\x1b":
                    # Start of escape sequence — read more characters
                    seq = ""
                    for _ in range(5):  # max sequence length
                        next_ch = sys.stdin.read(1)
                        if not next_ch:
                            break
                        seq += next_ch
                        if seq in self._ESCAPE_SEQUENCES:
                            self._queue.put(self._ESCAPE_SEQUENCES[seq])
                            break
                        # Check if we've hit a letter (end of CSI sequence)
                        if next_ch.isalpha() or next_ch == "~":
                            break
                elif ch == "q":
                    self._queue.put("quit")
            except Exception:
                if not self._running:
                    break


class Dashboard():
    """A live terminal dashboard for displaying data from the Bordercore API."""

    def __init__(self, session: Session) -> None:
        """Initializes the dashboard layout and configures API token and styling.

        Args:
            session: A configured requests.Session instance for making HTTP requests.
        """
        self.color_normal = Color.from_triplet(parse_rgb_hex("00ff00"))
        self.color_error = Color.from_triplet(parse_rgb_hex("ff0000"))

        if "DRF_TOKEN" not in os.environ:
            raise Exception("DRF_TOKEN not found in environment")
        self.drf_token = os.environ["DRF_TOKEN"]

        if "GITHUB_TOKEN" not in os.environ:
            raise Exception("GITHUB_TOKEN not found in environment")
        self.github_token = os.environ["GITHUB_TOKEN"]

        self.console = Console()
        self.layout = Layout()
        self.session = session

        # Initialize independent timers for each update function
        # Format: {function_name: {"last_update": timestamp, "interval": seconds}}
        default_interval = 10.0
        self.update_timers = {
            "bookmarks": {"last_update": 0.0, "interval": default_interval},
            "todos": {"last_update": 0.0, "interval": default_interval},
            "stats": {"last_update": 0.0, "interval": default_interval},
            "status": {"last_update": 0.0, "interval": default_interval},
            "code_echoes": {"last_update": 0.0, "interval": 600.0},  # 10 minutes
            "ups": {"last_update": 0.0, "interval": 60.0},  # 60 seconds
        }

        # Divide the "screen" in to three parts
        self.layout.split(
            Layout(name="header", size=3),
            Layout(ratio=1, name="main"),
            Layout(size=3, name="status"),
        )
        # Divide the "main" layout in to "side" and "left"
        self.layout["main"].split_row(
            Layout(name="side"),
            Layout(name="left", ratio=2)
        )
        # Divide the "side" layout in to three
        self.layout["side"].split(Layout(name="todo"), Layout(name="stats"), Layout(name="ups"))
        # Divide the "left" layout in to "bookmarks" and "code_echoes"
        self.layout["left"].split(Layout(name="bookmarks"), Layout(name="code_echoes"))

        color = Color.from_triplet(parse_rgb_hex("ffa500"))
        text = Text(justify="center", style=Style(color=color, bold=True))
        text.append("Bordercore Operations Console")
        self.layout["header"].update(Panel(
            text,
            title=Text("Bordercore")
        ))

        self.code_echoes_scroller = ScrollablePanel()

        self.layout["bookmarks"].update(Panel("Recent bookmarks", title="Bookmarks"))
        self.layout["code_echoes"].update(Panel("", title="Code Echoes"))
        self.layout["ups"].update(Panel("UPS status loading...", title="UPS Status"))

    def _get(self, url: str) -> dict[str, Any]:
        """Make an authenticated GET request to the API.

        Args:
            url: The full API endpoint to query.

        Returns:
            The parsed JSON response as a dictionary.

        Raises:
            Exception: If the response has a non-200 status code.
        """
        headers = {"Authorization": f"Token {self.drf_token}"}
        response: Response = self.session.get(url, headers=headers)
        if response.status_code != 200:
            raise Exception(f"API error ({url}): status={response.status_code}")
        return response.json()

    def update_status(self, status: str, error: bool = False) -> None:
        """Updates the bottom status bar with a message.

        Args:
            status: Text to display in the status panel.
            error: Whether to use the error color style.
        """
        if error:
            color = self.color_error
        else:
            color = self.color_normal

        self.layout["status"].update(
            Panel(
                Text(status, justify="center", style=Style(color=color)),
                title=Text("Status")
            )
        )
        self.update_timers["status"]["last_update"] = time.time()

    def update_bookmarks(self) -> None:
        """Fetches and displays recent bookmarks from the Bordercore API.

        Raises:
            Exception: If the API request fails.
        """
        info = self._get(BOOKMARKS_URL)
        colors = cycle(
            [
                Color.from_triplet(parse_rgb_hex("11ff00")),
                Color.from_triplet(parse_rgb_hex("56b04f"))
            ]
        )
        text = Text()

        for bookmark in info["results"]:
            text.append(bookmark["name"] + "\n", style=Style(color=next(colors)))
            self.layout["bookmarks"].update(Panel(
                text,
                title=Text("Bookmarks")
            ))
        self.update_timers["bookmarks"]["last_update"] = time.time()

    def update_todos(self) -> None:
        """Fetches and displays high-priority todos from the Bordercore API.

        Raises:
            Exception: If the API request fails.
        """
        info = self._get(TODOS_URL)
        colors = cycle(
            [
                Color.from_rgb(0, 136, 255),
                Color.from_rgb(73, 131, 182)
            ]
        )
        text = Text()

        for todo in info["results"]:
            text.append("• " + todo["name"] + "\n", style=Style(color=next(colors)))
            self.layout["todo"].update(Panel(
                text,
                title=Text("Todo Items")
            ))
        self.update_timers["todos"]["last_update"] = time.time()

    def update_stats(self) -> None:
        """Fetches and displays site statistics from the Bordercore API.

        Raises:
            Exception: If the API request fails.
        """
        info = self._get(STATS_URL)
        colors = cycle(
            [
                Color.from_rgb(168, 0, 146),
                Color.from_rgb(184, 40, 165)
            ]
        )

        table = Table(
            box=box.SIMPLE,
            style=Style(color=Color.from_rgb(184, 40, 165)),
            header_style=Style(color=next(colors)),
        )
        table.add_column("Name", justify="left", style=Style(color=Color.from_triplet(parse_rgb_hex("ee91e0"))))
        table.add_column("Value", style=Style(color=Color.from_triplet(parse_rgb_hex("9a488e"))))
        table.add_row("Unread Bookmarks", f"{info['untagged_bookmarks']}")
        table.add_row("Drill For Review", f"{info['drill_needing_review']['count']}")

        self.layout["stats"].update(Panel(
            table,
            title=Text("Site Stats")
        ))
        self.update_timers["stats"]["last_update"] = time.time()

    def update_ups(self) -> None:
        """Fetches and displays UPS status by running pwrstat command.

        Raises:
            Exception: If the command execution fails.
        """
        try:
            result = subprocess.run(
                ["sudo", "pwrstat", "-status"],
                capture_output=True,
                text=True,
                timeout=5
            )
            if result.returncode != 0:
                error_msg = result.stderr.strip() or f"Command failed with return code {result.returncode}"
                self.layout["ups"].update(Panel(
                    error_msg,
                    title=Text("UPS Status")
                ))
                self.update_timers["ups"]["last_update"] = time.time()
                return

            output = result.stdout
            state = None
            remaining_runtime = None
            load = None

            # Parse output line by line
            for line in output.splitlines():
                line = line.strip()
                if line.startswith("State"):
                    # Extract value after dots (e.g., "State........................ Normal" -> "Normal")
                    after_label = line.split("State", 1)[1]
                    # Remove leading dots and whitespace
                    value = after_label.lstrip(".").strip()
                    if value:
                        state = value
                elif line.startswith("Remaining Runtime"):
                    # Extract value after dots (e.g., "Remaining Runtime............ 58 min." -> "58 min.")
                    after_label = line.split("Remaining Runtime", 1)[1]
                    value = after_label.lstrip(".").strip()
                    if value:
                        remaining_runtime = value
                elif line.startswith("Load"):
                    # Extract value after dots (e.g., "Load......................... 130 Watt(13 %)" -> "13 %")
                    after_label = line.split("Load", 1)[1]
                    value = after_label.lstrip(".").strip()
                    if value:
                        # Extract percentage from parentheses (e.g., "130 Watt(13 %)" -> "13 %")
                        if "(" in value and ")" in value:
                            start = value.find("(") + 1
                            end = value.find(")")
                            if start > 0 and end > start:
                                load = value[start:end].strip()
                        else:
                            load = value

            # Create table similar to stats panel
            colors = cycle(
                [
                    Color.from_rgb(168, 0, 146),
                    Color.from_rgb(184, 40, 165)
                ]
            )

            table = Table(
                box=box.SIMPLE,
                style=Style(color=Color.from_rgb(184, 40, 165)),
                header_style=Style(color=next(colors)),
            )
            table.add_column("Name", justify="left", style=Style(color=Color.from_triplet(parse_rgb_hex("ee91e0"))))
            table.add_column("Value", style=Style(color=Color.from_triplet(parse_rgb_hex("9a488e"))))

            if state:
                table.add_row("State", state)
            if remaining_runtime:
                table.add_row("Runtime", remaining_runtime)
            if load:
                table.add_row("Load", load)

            if not state and not remaining_runtime and not load:
                # If we couldn't parse any fields, show raw output
                self.layout["ups"].update(Panel(
                    "Could not parse UPS status\n\n" + output[:200],
                    title=Text("UPS Status")
                ))
            else:
                self.layout["ups"].update(Panel(
                    table,
                    title=Text("UPS Status")
                ))

        except subprocess.TimeoutExpired:
            self.layout["ups"].update(Panel(
                "Command timed out",
                title=Text("UPS Status")
            ))
        except FileNotFoundError:
            self.layout["ups"].update(Panel(
                "pwrstat command not found",
                title=Text("UPS Status")
            ))
        except Exception as e:
            self.layout["ups"].update(Panel(
                f"Error: {str(e)}",
                title=Text("UPS Status")
            ))

        self.update_timers["ups"]["last_update"] = time.time()

    def _normalize_language(self, language: str) -> str:
        """Normalize GitHub language names to Pygments lexer names.

        Args:
            language: Language name from GitHub (may be None, empty, or in various formats)

        Returns:
            Normalized language name for Pygments
        """
        if not language:
            return "text"

        language = language.lower().strip()

        # Map common GitHub language names to Pygments lexer names
        language_map = {
            "javascript": "javascript",
            "typescript": "typescript",
            "python": "python",
            "java": "java",
            "c++": "cpp",
            "cpp": "cpp",
            "c": "c",
            "c#": "csharp",
            "csharp": "csharp",
            "go": "go",
            "rust": "rust",
            "ruby": "ruby",
            "php": "php",
            "swift": "swift",
            "kotlin": "kotlin",
            "scala": "scala",
            "html": "html",
            "css": "css",
            "json": "json",
            "yaml": "yaml",
            "yml": "yaml",
            "markdown": "markdown",
            "shell": "bash",
            "bash": "bash",
            "sh": "bash",
            "powershell": "powershell",
            "sql": "sql",
            "dockerfile": "dockerfile",
            "makefile": "make",
            "make": "make",
        }

        return language_map.get(language, language)

    def _is_minified_code(self, code: str) -> bool:
        """Detect minified/compressed code that would be expensive to syntax highlight."""
        lines = [line for line in code.split("\n") if line.strip()]
        if not lines:
            return False
        max_len = max(len(line) for line in lines)
        avg_len = sum(len(line) for line in lines) / len(lines)
        return max_len > 500 or avg_len > 200

    def update_code_echoes(self) -> None:
        """Updates the Code echoes panel with code samples from GitHub.

        Fetches code samples using GitHubCodeSampler and displays the code_preview
        with syntax highlighting based on the language field. Retries automatically
        if the fetched code is minified/compressed.
        """
        max_retries = 5
        retry_delay = 3  # seconds

        for attempt in range(max_retries):
            # Show status while fetching
            if attempt == 0:
                status_msg = "Retrieving code..."
            else:
                status_msg = f"Skipped minified code, retrying... ({attempt + 1}/{max_retries})"
            self.layout["code_echoes"].update(Panel(
                status_msg,
                title=Text("Code Echoes")
            ))

            sampler = GitHubCodeSampler(
                token=self.github_token,
                max_events=100,
                num_lines=None
            )
            sample_dict = sampler.get_sample()
            code_preview = sample_dict.get("code_preview", "No code preview available")
            lines = code_preview.split("\n")
            if len(lines) > CODE_ECHOES_MAX_LINES:
                code_preview = "\n".join(lines[:CODE_ECHOES_MAX_LINES])
            repo = sample_dict.get("repo", {})
            raw_language = repo.get("language", "text")
            language = self._normalize_language(raw_language)

            file_info = sample_dict.get("file", {})
            is_minified = self._is_minified_code(code_preview)

            if is_minified:
                if attempt < max_retries - 1:
                    time.sleep(retry_delay)
                    continue

            break

        # Build header with repo name and description
        header_parts = []

        # Repo name in blue as clickable link
        repo_name = repo.get("name", "")
        repo_url = repo.get("html_url", "")
        if repo_name:
            if repo_url:
                header_parts.append(Text(repo_name, style=f"blue link {repo_url}"))
            else:
                header_parts.append(Text(repo_name, style="blue"))

        # Description in green (if not empty and not "None")
        description = sample_dict.get("description", "") or repo.get("description", "")
        if description and description != "None":
            # Get first part (first line or first 100 chars)
            first_line = description.split("\n")[0]
            if len(first_line) > 100:
                first_line = first_line[:100] + "..."
            header_parts.append(Text(first_line, style="green"))

        # Filename (base filename and enclosing directory) in dim yellow
        filename = file_info.get("filename", "")
        if filename:
            # Extract directory and base filename
            dirname = os.path.dirname(filename)
            basename = os.path.basename(filename)
            if dirname:
                # Get just the last directory component
                parent_dir = os.path.basename(dirname)
                truncated_filename = f"{parent_dir}/{basename}"
            else:
                truncated_filename = basename
            header_parts.append(Text(truncated_filename, style="dim yellow"))

        # Language (raw, not normalized) on third line
        if raw_language:
            header_parts.append(Text(raw_language))

        # Add blank line
        header_parts.append(Text(""))

        # Create header text
        header = Text()
        for i, part in enumerate(header_parts):
            if i > 0:
                header.append("\n")
            header.append(part)

        try:
            syntax = Syntax(
                code_preview,
                language,
                theme="monokai",
                line_numbers=False,
                word_wrap=True
            )
        except Exception as e:
            syntax = Text(f"Syntax highlighting error: {e}\nLanguage: {raw_language} -> {language}\n\n{code_preview}")

        # Combine header and syntax, wrap in scrollable panel
        content = Group(header, syntax)
        self.code_echoes_scroller.update(content)

        self.layout["code_echoes"].update(Panel(
            self.code_echoes_scroller,
            title=Text("Code Echoes")
        ))
        self.update_timers["code_echoes"]["last_update"] = time.time()


def main() -> None:
    """Run the live Bordercore dashboard loop.

    Sets up the session, initializes the Dashboard, and continuously updates
    each section of the UI at its own independent interval. Supports keyboard
    scrolling of the Code Echoes panel via arrow keys and Page Up/Down.
    """
    session: Session = requests.Session()
    session.trust_env = False  # Ignore .netrc, useful for local dev

    dash = Dashboard(session=session)
    keys = KeyReader()
    current_time = time.time()

    # Initialize all timers to current time so they'll trigger on first loop
    for timer in dash.update_timers.values():
        timer["last_update"] = current_time - timer["interval"]

    keys.start()
    try:
        with Live(dash.layout, screen=True):
            while True:
                current_time = time.time()

                # Process keyboard input (non-blocking)
                while True:
                    key = keys.get_key()
                    if key is None:
                        break
                    if key == "quit":
                        return
                    elif key == "up":
                        dash.code_echoes_scroller.scroll_up()
                    elif key == "down":
                        dash.code_echoes_scroller.scroll_down()
                    elif key == "page_up":
                        dash.code_echoes_scroller.page_up()
                    elif key == "page_down":
                        dash.code_echoes_scroller.page_down()

                # Check and update bookmarks if its timer has elapsed
                if current_time - dash.update_timers["bookmarks"]["last_update"] >= dash.update_timers["bookmarks"]["interval"]:
                    try:
                        dash.update_bookmarks()
                    except Exception as e:
                        dash.update_status(str(e), error=True)

                # Check and update todos if its timer has elapsed
                if current_time - dash.update_timers["todos"]["last_update"] >= dash.update_timers["todos"]["interval"]:
                    try:
                        dash.update_todos()
                    except Exception as e:
                        dash.update_status(str(e), error=True)

                # Check and update stats if its timer has elapsed
                if current_time - dash.update_timers["stats"]["last_update"] >= dash.update_timers["stats"]["interval"]:
                    try:
                        dash.update_stats()
                    except Exception as e:
                        dash.update_status(str(e), error=True)

                # Check and update status if its timer has elapsed
                if current_time - dash.update_timers["status"]["last_update"] >= dash.update_timers["status"]["interval"]:
                    try:
                        dash.update_status("All subsystems normal")
                    except Exception as e:
                        dash.update_status(str(e), error=True)

                # Check and update code_echoes if its timer has elapsed
                if current_time - dash.update_timers["code_echoes"]["last_update"] >= dash.update_timers["code_echoes"]["interval"]:
                    try:
                        dash.update_code_echoes()
                    except Exception as e:
                        dash.update_status(str(e), error=True)

                # Check and update ups if its timer has elapsed
                if current_time - dash.update_timers["ups"]["last_update"] >= dash.update_timers["ups"]["interval"]:
                    try:
                        dash.update_ups()
                    except Exception as e:
                        dash.update_status(str(e), error=True)

                # Sleep for a short interval to avoid busy-waiting
                time.sleep(0.1)
    finally:
        keys.stop()

if __name__ == "__main__":
    main()
