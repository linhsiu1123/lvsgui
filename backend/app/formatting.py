"""Presentation helpers.

The console renders relative dates ("Today 09:12"). Those strings are derived
here at *read* time from a stored timestamp — never stored themselves, because
a stored "Today" is wrong the moment the day rolls over.
"""

from __future__ import annotations

import re
from datetime import datetime

# Matches a leading "<rendered time> · " written by older versions, so the
# migration can recover the underlying message.
_LEGACY_PREFIX = re.compile(r"^(?:Today|Yesterday|\d{1,2}/\d{1,2})\s+\d{1,2}:\d{2}\s+·\s+")


def display_time(at: datetime, *, now: datetime | None = None) -> str:
    """Render a timestamp the way the console shows it.

    Today -> "Today 09:12", yesterday -> "Yesterday 16:40", older -> "7/03 11:05".
    """
    now = now or datetime.now(tz=at.tzinfo)
    delta_days = (now.date() - at.date()).days
    clock = at.strftime("%H:%M")
    if delta_days == 0:
        return f"Today {clock}"
    if delta_days == 1:
        return f"Yesterday {clock}"
    return f"{at.month}/{at.day:02d} {clock}"


def clock(at: datetime) -> str:
    """Wall-clock only, for the activity feed."""
    return at.strftime("%H:%M")


def strip_time_prefix(text: str) -> str:
    """Remove a frozen "<time> · " prefix from a legacy event message."""
    return _LEGACY_PREFIX.sub("", text, count=1)
