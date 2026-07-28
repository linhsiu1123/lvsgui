"""Demo fixtures.

Mirrors `components/signagent/data.ts` so a fresh database gives the console the
same content it ships with as static demo data. Timestamps are relative to now,
so a seeded database never looks stale.

Only ever inserted into empty collections — seeding never overwrites real data.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any

from pymongo.asynchronous.database import AsyncDatabase

from .db import CASES, ROUTING_FLOWS, SKILLS
from .domain import display_time
from .models import CaseItem, RouteDef, RouteStep, SkillDef

log = logging.getLogger(__name__)

DEFAULT_CHAIN = ["node1", "node2", "node3"]

LIN = "Verification Dep. Mgr. Lin"
WANG = "Design Center Assoc. Mgr. Wang"


def _at(days_ago: int, hour: int, minute: int) -> datetime:
    base = datetime.now(timezone.utc) - timedelta(days=days_ago)
    return base.replace(hour=hour, minute=minute, second=0, microsecond=0)


def seed_cases() -> list[CaseItem]:
    def case(**kw: Any) -> CaseItem:
        submitted_at: datetime = kw.pop("submitted_at")
        return CaseItem(submitted_at=submitted_at, time=display_time(submitted_at), **kw)

    return [
        case(
            id="QC-2607",
            title="LVS Verification Report RPT-8821",
            type="LVS Verification Report",
            ver="v1.0",
            submitter="Chen Ya-ting",
            submitted_at=_at(0, 9, 12),
            risk="Low",
            status="auto",
            route=[RouteStep(name="Agent Auto-approve", state="done")],
            last_event="Agent pre-review passed, auto-approved by low-risk rule",
        ),
        case(
            id="QC-2606",
            title="Rule Deck Change RD-0981 M0 device compare",
            type="Rule Deck Change",
            ver="v2.1",
            submitter="Chen Ya-ting",
            submitted_at=_at(1, 16, 40),
            risk="Medium",
            status="pending",
            route_idx=0,
            route=[RouteStep(name=LIN), RouteStep(name=WANG)],
            last_event=f"Agent pre-review done, routed to {LIN}",
        ),
        case(
            id="QC-2605",
            title="Waiver Request WV-0331",
            type="Waiver Request",
            ver="v1.0",
            submitter="Liu Chien-hung",
            submitted_at=_at(3, 11, 5),
            risk="Medium",
            status="pending",
            route_idx=0,
            route=[RouteStep(name=LIN)],
            last_event="Agent detected an open linked ECO",
        ),
        case(
            id="QC-2604",
            title="Waiver Request WV-0312",
            type="Waiver Request",
            ver="v3.0",
            submitter="Liu Chien-hung",
            submitted_at=_at(5, 14, 22),
            risk="High",
            status="rejected",
            route_idx=0,
            route=[RouteStep(name=LIN, state="rejected")],
            last_event="Dep. Mgr. Lin rejected: false-alarm root-cause analysis lacks evidence",
        ),
        case(
            id="QC-2603",
            title="LVS Verification Report RPT-8790",
            type="LVS Verification Report",
            ver="v1.0",
            submitter="Wu Meng-chun",
            submitted_at=_at(6, 10, 18),
            risk="Low",
            status="auto",
            route=[RouteStep(name="Agent Auto-approve", state="done")],
            last_event="Agent pre-review passed, auto-approved",
        ),
        case(
            id="QC-2602",
            title="Rule Deck Change RD-0774 IP merge flow",
            type="Rule Deck Change",
            ver="v4.0",
            submitter="Wu Meng-chun",
            submitted_at=_at(8, 9, 40),
            risk="Medium",
            status="approved",
            route_idx=2,
            route=[RouteStep(name=LIN, state="done"), RouteStep(name=WANG, state="done")],
            last_event="Assoc. Mgr. Wang approved, approval complete",
        ),
    ]


def seed_flows() -> dict[str, RouteDef]:
    return {
        "Pipeline1": RouteDef(
            meta="v3 · updated 6/28 · System Admin", mid=["v", "d"], high=["v", "d", "g"], chain=list(DEFAULT_CHAIN)
        ),
        "Pipeline2": RouteDef(
            meta="v2 · updated 5/14 · System Admin", mid=["v"], high=["v", "d"], chain=list(DEFAULT_CHAIN)
        ),
        "Pipeline3": RouteDef(
            meta="v4 · updated 6/03 · System Admin", mid=["v"], high=["v", "d"], chain=list(DEFAULT_CHAIN)
        ),
    }


def seed_skills() -> list[SkillDef]:
    return [
        SkillDef(
            key="route",
            glyph="RT",
            name="Routing Decision",
            desc="Automatically decides which managers and how many approval levels based on doc type and risk.",
        ),
        SkillDef(
            key="precheck",
            glyph="PR",
            name="Pre-review & Recommendation",
            desc="Checks format, attachments, version, and linked ECO before routing, "
            "with an approve/reject recommendation.",
        ),
        SkillDef(
            key="auto",
            glyph="OK",
            name="Low-risk Auto-approve",
            desc="Low-risk requests skip manual approval; audited afterward by the approval lead (20% sampling).",
        ),
        SkillDef(
            key="anomaly",
            glyph="AL",
            name="Anomaly Detection",
            desc="Watches for resubmissions, mismatched attachments, and routing bypasses; "
            "alerts the approval lead in real time.",
        ),
    ]


async def seed_if_empty(database: AsyncDatabase[dict[str, Any]]) -> None:
    """Populate empty collections. A no-op once anything is stored."""
    if await database[CASES].count_documents({}, limit=1) == 0:
        await database[CASES].insert_many([c.model_dump(by_alias=True) for c in seed_cases()])
        log.info("Seeded demo approval documents")

    if await database[ROUTING_FLOWS].count_documents({}, limit=1) == 0:
        await database[ROUTING_FLOWS].insert_many(
            [{"name": name, **flow.model_dump(by_alias=True, exclude_none=True)} for name, flow in seed_flows().items()]
        )
        log.info("Seeded routing flows")

    if await database[SKILLS].count_documents({}, limit=1) == 0:
        await database[SKILLS].insert_many([s.model_dump(by_alias=True) for s in seed_skills()])
        log.info("Seeded agent skills")
