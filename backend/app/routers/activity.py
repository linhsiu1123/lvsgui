"""Agent activity feed — `/qc/activity`."""

from __future__ import annotations

from fastapi import APIRouter, Query

from ..db import ACTIVITY, Database
from ..models import ActivityItem
from ..security import CurrentPrincipal

router = APIRouter(prefix="/qc/activity", tags=["activity"])


@router.get("", response_model=list[ActivityItem])
async def list_activity(
    database: Database,
    _: CurrentPrincipal,
    limit: int = Query(default=50, ge=1, le=200),
) -> list[ActivityItem]:
    """Newest first, matching the order the console's feed renders."""
    cursor = database[ACTIVITY].find({}, projection={"_id": False}).sort("at", -1).limit(limit)
    return [ActivityItem.model_validate(doc) async for doc in cursor]
