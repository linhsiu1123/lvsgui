"""Display strings must be derived on read, never frozen at write time.

Storing "Today 09:12" made every document lie the moment the day rolled over.
These tests pin the fix: nothing time-shaped is persisted, and the rendered
form tracks the clock.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest

from app.formatting import display_time, strip_time_prefix
from app.migrations import backfill_flow_defaults, unfreeze_display_strings
from app.models import ACTIVITY_PERSIST_EXCLUDE, CASE_PERSIST_EXCLUDE, ActivityItem, CaseItem

from .fake_mongo import FakeDatabase

AT = datetime(2026, 7, 28, 9, 12, tzinfo=timezone.utc)


def a_case(**kw) -> CaseItem:
    base = dict(
        id="QC-1",
        title="Doc",
        type="Rule Deck Change",
        ver="v1.0",
        submitter="Chen",
        risk="Low",
        status="auto",
        submitted_at=AT,
    )
    return CaseItem(**{**base, **kw})


class TestDerivedOnRead:
    def test_the_same_document_renders_differently_as_days_pass(self, monkeypatch: pytest.MonkeyPatch) -> None:
        case = a_case()

        def freeze(when: datetime) -> None:
            monkeypatch.setattr("app.formatting.datetime", _FrozenClock(when))

        freeze(AT)
        assert case.time == "Today 09:12"

        freeze(AT + timedelta(days=1))
        assert case.time == "Yesterday 09:12"

        freeze(AT + timedelta(days=5))
        assert case.time == "7/28 09:12"

    def test_last_event_carries_a_freshly_rendered_timestamp(self) -> None:
        case = a_case(last_event_text="Lin approved", last_event_at=AT)
        assert case.last_event == f"{display_time(AT)} · Lin approved"

    def test_last_event_without_a_timestamp_is_just_the_message(self) -> None:
        assert a_case(last_event_text="Submitted").last_event == "Submitted"

    def test_no_event_means_no_line(self) -> None:
        assert a_case().last_event == ""

    def test_activity_time_comes_from_its_timestamp(self) -> None:
        assert ActivityItem(icon="OK", chip="green", text="done", at=AT).time == "09:12"


class TestNothingTimeShapedIsStored:
    def test_case_persist_payload_omits_rendered_strings(self) -> None:
        stored = a_case(last_event_text="Lin approved", last_event_at=AT).model_dump(
            by_alias=True, exclude=CASE_PERSIST_EXCLUDE
        )
        assert "time" not in stored
        assert "lastEvent" not in stored
        # the underlying facts are what persist
        assert stored["lastEventText"] == "Lin approved"
        assert stored["lastEventAt"] == AT
        assert stored["submittedAt"] == AT

    def test_activity_persist_payload_omits_the_clock(self) -> None:
        stored = ActivityItem(icon="OK", chip="green", text="done", at=AT).model_dump(
            by_alias=True, exclude=ACTIVITY_PERSIST_EXCLUDE
        )
        assert "time" not in stored
        assert stored["at"] == AT

    def test_the_api_still_exposes_both_rendered_fields(self) -> None:
        wire = a_case(last_event_text="Lin approved", last_event_at=AT).model_dump(by_alias=True)
        assert wire["time"].endswith("09:12")
        assert wire["lastEvent"].endswith("Lin approved")


class TestLegacyPrefixStripping:
    @pytest.mark.parametrize(
        "stored,expected",
        [
            ("Today 14:39 · Debug User approved", "Debug User approved"),
            ("Yesterday 16:40 · Agent pre-review done", "Agent pre-review done"),
            ("7/03 11:05 · Agent detected an open ECO", "Agent detected an open ECO"),
            ("Agent pre-review passed", "Agent pre-review passed"),  # never had a prefix
            ("", ""),
        ],
    )
    def test_recovers_the_message(self, stored: str, expected: str) -> None:
        assert strip_time_prefix(stored) == expected

    def test_leaves_a_middle_dot_inside_the_message_alone(self) -> None:
        assert strip_time_prefix("Lin approved · routed onward") == "Lin approved · routed onward"


class TestMigrations:
    async def test_unfreezes_legacy_documents(self) -> None:
        db = FakeDatabase()
        await db["cases"].insert_one(
            {"id": "QC-1", "time": "Today 09:12", "lastEvent": "Today 14:39 · Lin approved", "submittedAt": AT}
        )
        await db["activity"].insert_one({"icon": "OK", "chip": "green", "text": "x", "time": "14:39", "at": AT})

        assert await unfreeze_display_strings(db) == 1  # type: ignore[arg-type]

        doc = await db["cases"].find_one({"id": "QC-1"})
        assert doc is not None
        assert doc["lastEventText"] == "Lin approved"
        assert doc["lastEventAt"] == AT
        assert "time" not in doc and "lastEvent" not in doc

        event = await db["activity"].find_one({"icon": "OK"})
        assert event is not None and "time" not in event

    async def test_is_idempotent(self) -> None:
        db = FakeDatabase()
        await db["cases"].insert_one({"id": "QC-1", "time": "Today 09:12", "lastEvent": "Lin approved", "submittedAt": AT})

        assert await unfreeze_display_strings(db) == 1  # type: ignore[arg-type]
        assert await unfreeze_display_strings(db) == 0  # type: ignore[arg-type]

    async def test_backfills_flow_defaults_only_where_missing(self) -> None:
        db = FakeDatabase()
        await db["routing_flows"].insert_one({"name": "Old", "meta": "v1", "mid": [], "high": []})
        await db["routing_flows"].insert_one(
            {"name": "New", "meta": "v1", "mid": [], "high": [], "enabled": False, "nodeSkills": {"n0": "auto"}}
        )

        assert await backfill_flow_defaults(db) == 1  # type: ignore[arg-type]

        old = await db["routing_flows"].find_one({"name": "Old"})
        assert old is not None
        assert old["enabled"] is True and old["nodeSkills"] == {} and old["nodeVerify"] == {}

        # an already-configured flow is left exactly as it was
        new = await db["routing_flows"].find_one({"name": "New"})
        assert new is not None
        assert new["enabled"] is False and new["nodeSkills"] == {"n0": "auto"}


class _FrozenClock:
    """Stands in for `datetime` so `display_time`'s default `now` is fixed."""

    def __init__(self, when: datetime) -> None:
        self._when = when

    def now(self, tz=None):  # noqa: ANN001, ANN201 - mirrors datetime.now
        return self._when.astimezone(tz) if tz else self._when
