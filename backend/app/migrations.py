"""Idempotent data migrations, run at startup.

Unlike seeding, these touch collections that already hold data. Every one is
safe to run repeatedly and targets only the documents that still need it.
"""

from __future__ import annotations

import logging
from typing import Any

from pymongo.asynchronous.database import AsyncDatabase

from .db import ACTIVITY, CASES, ROUTING_FLOWS
from .formatting import strip_time_prefix

log = logging.getLogger(__name__)


async def unfreeze_display_strings(database: AsyncDatabase[dict[str, Any]]) -> int:
    """Move frozen `time`/`lastEvent` strings onto real timestamps.

    Earlier versions stored the *rendered* relative time, so a document written
    yesterday still claimed "Today". The rendered forms are now derived on read
    from `submittedAt`/`lastEventAt`, so the stored copies are dropped and the
    underlying message recovered.

    The original event time was never recorded, so `lastEventAt` falls back to
    `submittedAt`. That is a lower bound, not the true decision time.
    """
    migrated = 0
    async for doc in database[CASES].find({"lastEventText": {"$exists": False}}, projection={"_id": False}):
        text = strip_time_prefix(doc.get("lastEvent", "") or "")
        await database[CASES].update_one(
            {"id": doc["id"]},
            {
                "$set": {"lastEventText": text, "lastEventAt": doc.get("submittedAt")},
                "$unset": {"lastEvent": "", "time": ""},
            },
        )
        migrated += 1

    # Drop the stored clock string on feed entries; it is derived from `at`.
    result = await database[ACTIVITY].update_many({"time": {"$exists": True}}, {"$unset": {"time": ""}})
    if migrated or result.modified_count:
        log.info(
            "Unfroze display strings on %d document(s) and %d activity entr(ies)",
            migrated,
            result.modified_count,
        )
    return migrated


async def backfill_flow_defaults(database: AsyncDatabase[dict[str, Any]]) -> int:
    """Fill in flow fields added after the first seed.

    `enabled`/`nodeSkills`/`nodeVerify` were introduced later, and seeding only
    populates empty collections, so pipelines created before then lack them.
    The readers default correctly, but leaving the divergence in place means
    every consumer has to keep guessing.
    """
    result = await database[ROUTING_FLOWS].update_many(
        {"enabled": {"$exists": False}},
        {"$set": {"enabled": True, "nodeSkills": {}, "nodeVerify": {}}},
    )
    if result.modified_count:
        log.info("Backfilled defaults on %d routing flow(s)", result.modified_count)
    return result.modified_count


async def run_all(database: AsyncDatabase[dict[str, Any]]) -> None:
    await unfreeze_display_strings(database)
    await backfill_flow_defaults(database)
