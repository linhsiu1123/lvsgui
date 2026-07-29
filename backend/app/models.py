"""API models.

Field names are serialised in camelCase to match the TypeScript types the
frontend already has in `components/signagent/data.ts` — `routeIdx`,
`lastEvent`, `currentLevel2`. Python keeps its snake_case internally.
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, computed_field
from pydantic.alias_generators import to_camel

from .formatting import clock, display_time

RiskLevel = Literal["Low", "Medium", "High"]
CaseStatus = Literal["auto", "pending", "approved", "rejected"]
StageState = Literal["done", "rejected"]
ChipColour = Literal["accent", "amber", "green"]


class ApiModel(BaseModel):
    """Base: camelCase on the wire, snake_case in Python, populate by either."""

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


# ── Approval documents ──────────────────────────────────────────────


class RouteStep(ApiModel):
    name: str
    state: StageState | None = None


class CaseItem(ApiModel):
    id: str
    title: str
    type: str
    ver: str
    submitter: str
    risk: RiskLevel
    status: CaseStatus
    route: list[RouteStep] = Field(default_factory=list)
    route_idx: int | None = None
    current_level2: bool | None = None
    submitted_at: datetime | None = None

    # Audit line, stored WITHOUT a rendered time so it never goes stale.
    last_event_text: str = ""
    last_event_at: datetime | None = None

    # ── derived on read, never stored (see PERSIST_EXCLUDE) ──

    @computed_field  # type: ignore[prop-decorator]
    @property
    def time(self) -> str:
        """Relative submission time, as the console shows it."""
        return display_time(self.submitted_at) if self.submitted_at else ""

    @computed_field  # type: ignore[prop-decorator]
    @property
    def last_event(self) -> str:
        """The audit line with its timestamp rendered fresh."""
        if not self.last_event_text:
            return ""
        if self.last_event_at is None:
            return self.last_event_text
        return f"{display_time(self.last_event_at)} · {self.last_event_text}"


# Computed fields must not be written back to MongoDB — storing them is what
# froze the display strings in the first place.
CASE_PERSIST_EXCLUDE = {"time", "last_event"}


class RejectRequest(ApiModel):
    reason: str = Field(min_length=1, description="Required, shown in the audit trail")


# ── Routing flows ───────────────────────────────────────────────────


class RouteDef(ApiModel):
    meta: str
    mid: list[str] = Field(default_factory=list)
    high: list[str] = Field(default_factory=list)
    # Ordered chain of freely named flow nodes (the current canvas model).
    chain: list[str] | None = None
    removed: list[str] | None = None
    cfg: dict[str, dict[str, str]] | None = None
    # Whether the whole rule is active (the canvas toolbar's switch).
    enabled: bool = True
    # Per-node settings, keyed by node id ("n0", "n1", ...) within this flow.
    # `node_skills` maps a node to an agent skill key; `node_verify` to whether
    # that node needs a human confirmation.
    node_skills: dict[str, str] = Field(default_factory=dict)
    node_verify: dict[str, bool] = Field(default_factory=dict)


# ── Agent skills ────────────────────────────────────────────────────


class SkillDef(ApiModel):
    key: str
    glyph: str
    name: str
    desc: str
    enabled: bool = True


class SkillCreateRequest(ApiModel):
    """A new skill. `key` is the immutable identity flow nodes bind to."""

    key: str = Field(
        min_length=1,
        max_length=32,
        pattern=r"^[a-z0-9][a-z0-9_-]*$",
        description="Lowercase slug, e.g. 'duplicate-check'",
    )
    glyph: str = Field(min_length=1, max_length=4, description="Short badge drawn on the card")
    name: str = Field(min_length=1, max_length=128)
    desc: str = Field(min_length=1)
    enabled: bool = True


class SkillUpdateRequest(ApiModel):
    """Partial edit. Omitted fields are left alone; `key` is not editable."""

    glyph: str | None = Field(default=None, min_length=1, max_length=4)
    name: str | None = Field(default=None, min_length=1, max_length=128)
    desc: str | None = Field(default=None, min_length=1)
    enabled: bool | None = None

    def changes(self) -> dict[str, object]:
        return self.model_dump(by_alias=True, exclude_none=True)


# ── Activity feed ───────────────────────────────────────────────────


class ActivityItem(ApiModel):
    icon: str
    chip: ChipColour
    text: str
    sub: str = ""
    at: datetime | None = None

    @computed_field  # type: ignore[prop-decorator]
    @property
    def time(self) -> str:
        return clock(self.at) if self.at else ""


ACTIVITY_PERSIST_EXCLUDE = {"time"}
