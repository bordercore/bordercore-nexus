"""Tests for lib.scrollable_panel.ScrollablePanel."""

from io import StringIO
from unittest.mock import MagicMock, PropertyMock, patch

from rich.console import Console, ConsoleOptions
from rich.text import Text

from lib.scrollable_panel import THUMB_CHAR, TRACK_CHAR, ScrollablePanel


def test_update_resets_scroll() -> None:
    panel = ScrollablePanel()
    panel._scroll_offset = 5
    panel.update(Text("x"))
    assert panel._scroll_offset == 0


def test_max_scroll() -> None:
    panel = ScrollablePanel()
    panel._total_lines = 10
    panel._visible_height = 3
    assert panel.max_scroll == 7


def test_max_scroll_no_overflow() -> None:
    panel = ScrollablePanel()
    panel._total_lines = 3
    panel._visible_height = 10
    assert panel.max_scroll == 0


def test_can_scroll() -> None:
    panel = ScrollablePanel()
    panel._total_lines = 5
    panel._visible_height = 3
    assert panel.can_scroll
    panel._total_lines = 2
    panel._visible_height = 10
    assert not panel.can_scroll


def test_scroll_up_down_clamp() -> None:
    panel = ScrollablePanel()
    panel._total_lines = 5
    panel._visible_height = 2
    panel.scroll_down(100)
    assert panel._scroll_offset == 3
    panel.scroll_up(100)
    assert panel._scroll_offset == 0


def test_page_up_down() -> None:
    panel = ScrollablePanel()
    panel._visible_height = 5
    panel._total_lines = 20
    panel._scroll_offset = 10
    panel.page_up()
    assert panel._scroll_offset == 6
    panel.page_down()
    assert panel._scroll_offset == 10


def test_scroll_to_top_bottom() -> None:
    panel = ScrollablePanel()
    panel._total_lines = 10
    panel._visible_height = 2
    panel.scroll_to_bottom()
    assert panel._scroll_offset == 8
    panel.scroll_to_top()
    assert panel._scroll_offset == 0


def test_at_top_at_bottom() -> None:
    panel = ScrollablePanel()
    panel._total_lines = 5
    panel._visible_height = 2
    panel._scroll_offset = 0
    assert panel.at_top
    assert not panel.at_bottom
    panel._scroll_offset = 3
    assert not panel.at_top
    assert panel.at_bottom


def test_build_scrollbar_no_scroll() -> None:
    panel = ScrollablePanel()
    panel._total_lines = 3
    panel._visible_height = 10
    bar = panel._build_scrollbar(5)
    assert bar == [TRACK_CHAR] * 5


def test_build_scrollbar_zero_track() -> None:
    panel = ScrollablePanel()
    panel._total_lines = 100
    panel._visible_height = 2
    assert panel._build_scrollbar(0) == []


def test_build_scrollbar_with_thumb() -> None:
    panel = ScrollablePanel()
    panel._total_lines = 20
    panel._visible_height = 4
    panel._scroll_offset = 0
    bar = panel._build_scrollbar(8)
    assert THUMB_CHAR in bar
    assert TRACK_CHAR in bar


def test_build_scrollbar_thumb_top_when_max_scroll_reports_zero() -> None:
    panel = ScrollablePanel()
    panel._total_lines = 20
    panel._visible_height = 4
    panel._scroll_offset = 3
    with patch.object(
        ScrollablePanel,
        "max_scroll",
        new_callable=PropertyMock,
        return_value=0,
    ):
        bar = panel._build_scrollbar(6)
    assert THUMB_CHAR in bar


def test_rich_measure() -> None:
    panel = ScrollablePanel()
    console = Console()
    options = console.options.update(width=80)
    measurement = panel.__rich_measure__(console, options)
    assert measurement.minimum == 80
    assert measurement.maximum == 80


def test_rich_console_sets_dimensions_and_clamps_scroll() -> None:
    panel = ScrollablePanel()
    panel.update(Text("\n".join(f"line {i}" for i in range(30))))
    panel._scroll_offset = 1000
    console = Console(width=40, file=StringIO(), force_terminal=True)
    options = console.options.update(height=5, max_width=40)
    rendered = list(console.render(panel, options))
    assert panel._visible_height == 5
    assert panel._total_lines >= 30
    assert panel._scroll_offset <= panel.max_scroll
    assert len(rendered) > 0


def test_rich_console_pads_when_content_shorter_than_viewport() -> None:
    panel = ScrollablePanel()
    panel.update(Text("short\ncontent"))
    console = Console(width=40, file=StringIO(), force_terminal=True)
    options = console.options.update(height=8, max_width=40)
    list(console.render(panel, options))
    assert panel._total_lines < 8


def test_rich_console_fallback_height_when_options_unsized() -> None:
    panel = ScrollablePanel()
    panel.update(Text("a\nb\nc"))
    console = Console(width=40, file=StringIO(), force_terminal=True)
    inner = console.options.update(width=39, height=None)
    opts = MagicMock(spec=ConsoleOptions)
    opts.height = None
    opts.max_height = None
    opts.max_width = 40
    opts.update.return_value = inner
    list(panel.__rich_console__(console, opts))
    assert panel._visible_height == 20
