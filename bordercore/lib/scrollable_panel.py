"""A scrollable Rich renderable with a vertical scrollbar.

Wraps any Rich renderable and adds vertical scrolling support with a
visual scrollbar track. Content beyond the visible area can be accessed
via scroll_up/scroll_down/page_up/page_down methods.
"""

from __future__ import annotations

from rich.console import Console, ConsoleOptions, RenderableType, RenderResult
from rich.measure import Measurement
from rich.segment import Segment
from rich.style import Style
from rich.text import Text


# Scrollbar characters
TRACK_CHAR = "░"
THUMB_CHAR = "█"

SCROLLBAR_STYLE = Style(color="color(239)")
THUMB_STYLE = Style(color="color(245)")


class ScrollablePanel:
    """A Rich renderable that supports vertical scrolling with a scrollbar.

    Renders all content lines from the wrapped renderable, then slices to
    the visible window based on the current scroll offset. A 1-column
    scrollbar is drawn on the right edge.
    """

    def __init__(self) -> None:
        self._content: RenderableType = Text("")
        self._scroll_offset: int = 0
        self._total_lines: int = 0
        self._visible_height: int = 0

    def update(self, renderable: RenderableType) -> None:
        """Replace the content and reset scroll position to the top."""
        self._content = renderable
        self._scroll_offset = 0

    def scroll_up(self, n: int = 1) -> None:
        """Scroll up by n lines."""
        self._scroll_offset = max(0, self._scroll_offset - n)

    def scroll_down(self, n: int = 1) -> None:
        """Scroll down by n lines."""
        max_offset = self.max_scroll
        self._scroll_offset = min(max_offset, self._scroll_offset + n)

    def page_up(self) -> None:
        """Scroll up by one page."""
        self.scroll_up(max(1, self._visible_height - 1))

    def page_down(self) -> None:
        """Scroll down by one page."""
        self.scroll_down(max(1, self._visible_height - 1))

    def scroll_to_top(self) -> None:
        """Scroll to the very top."""
        self._scroll_offset = 0

    def scroll_to_bottom(self) -> None:
        """Scroll to the very bottom."""
        self._scroll_offset = self.max_scroll

    @property
    def max_scroll(self) -> int:
        """Maximum valid scroll offset."""
        return max(0, self._total_lines - self._visible_height)

    @property
    def can_scroll(self) -> bool:
        """Whether the content is taller than the visible area."""
        return self._total_lines > self._visible_height

    @property
    def at_top(self) -> bool:
        return self._scroll_offset <= 0

    @property
    def at_bottom(self) -> bool:
        return self._scroll_offset >= self.max_scroll

    def __rich_console__(
        self, console: Console, options: ConsoleOptions
    ) -> RenderResult:
        visible_height = options.height or options.max_height
        if visible_height is None:
            visible_height = 20

        # Reserve 1 column for the scrollbar
        content_width = options.max_width - 1

        # Render ALL content lines (no height limit)
        content_options = options.update(width=content_width, height=None)
        all_lines = console.render_lines(
            self._content, content_options, pad=True
        )

        self._total_lines = len(all_lines)
        self._visible_height = visible_height

        # Clamp scroll offset
        self._scroll_offset = max(
            0, min(self._scroll_offset, self.max_scroll)
        )

        # Slice to visible window
        visible_lines = all_lines[
            self._scroll_offset : self._scroll_offset + visible_height
        ]

        # Pad if we have fewer lines than visible height
        newline = Segment.line()
        blank_segment = Segment(" " * content_width)

        # Build scrollbar column
        scrollbar = self._build_scrollbar(visible_height)

        for i, line_segments in enumerate(visible_lines):
            yield from line_segments
            yield Segment(scrollbar[i], THUMB_STYLE if scrollbar[i] == THUMB_CHAR else SCROLLBAR_STYLE)
            yield newline

        # Fill remaining rows if content is shorter than visible area
        for i in range(len(visible_lines), visible_height):
            yield blank_segment
            yield Segment(scrollbar[i] if i < len(scrollbar) else TRACK_CHAR, SCROLLBAR_STYLE)
            yield newline

    def __rich_measure__(
        self, console: Console, options: ConsoleOptions
    ) -> Measurement:
        return Measurement(options.max_width, options.max_width)

    def _build_scrollbar(self, track_height: int) -> list[str]:
        """Build a list of single characters representing the scrollbar track."""
        if not self.can_scroll or track_height <= 0:
            return [TRACK_CHAR] * track_height

        total = self._total_lines
        # Thumb size proportional to visible fraction, minimum 1
        thumb_size = max(1, round(track_height * track_height / total))
        thumb_size = min(thumb_size, track_height)

        # Thumb position maps scroll_offset to track range
        scrollable_track = track_height - thumb_size
        if self.max_scroll > 0:
            thumb_top = round(self._scroll_offset / self.max_scroll * scrollable_track)
        else:
            thumb_top = 0
        thumb_top = max(0, min(thumb_top, scrollable_track))

        track = []
        for i in range(track_height):
            if thumb_top <= i < thumb_top + thumb_size:
                track.append(THUMB_CHAR)
            else:
                track.append(TRACK_CHAR)
        return track
