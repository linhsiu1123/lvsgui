"""Approval documents — `/qc/documents`.

Paths match `config/services.ts` in the Next.js app.
"""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Query, status

from ..db import ACTIVITY, CASES, Database
from ..domain import ApprovalError, approval_event, approve, reject, rejection_event
from ..models import ACTIVITY_PERSIST_EXCLUDE, CASE_PERSIST_EXCLUDE, CaseItem, RejectRequest
from ..security import CurrentPrincipal

router = APIRouter(prefix="/qc/documents", tags=["documents"])


async def _load(database: Database, case_id: str) -> CaseItem:
    doc = await database[CASES].find_one({"id": case_id}, projection={"_id": False})
    if doc is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": "not_found", "detail": f"No document {case_id}"},
        )
    return CaseItem.model_validate(doc)


async def _persist(database: Database, case: CaseItem, *, expected: CaseItem) -> None:
    """Write the transition, but only if nobody else decided first.

    Approve/reject is read-modify-write. Filtering on the state we read makes
    it optimistic-locking: a second approver racing on the same stage matches
    nothing and gets a 409 instead of silently overwriting the first decision.
    """
    result = await database[CASES].update_one(
        {"id": case.id, "status": expected.status, "routeIdx": expected.route_idx},
        {"$set": case.model_dump(by_alias=True, exclude={"id", *CASE_PERSIST_EXCLUDE})},
    )
    if result.matched_count == 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "error": "concurrent_modification",
                "detail": f"{case.id} was decided by someone else; reload and try again",
            },
        )


@router.get("", response_model=list[CaseItem])
async def list_cases(
    database: Database,
    _: CurrentPrincipal,
    type: str | None = Query(default=None, description="Filter by product type"),
    limit: int = Query(default=200, ge=1, le=500, description="Maximum documents to return"),
) -> list[CaseItem]:
    """Newest first. Bounded — an unbounded list would grow with the archive."""
    query = {"type": type} if type else {}
    cursor = database[CASES].find(query, projection={"_id": False}).sort("submittedAt", -1).limit(limit)
    return [CaseItem.model_validate(doc) async for doc in cursor]


@router.get("/{case_id}", response_model=CaseItem)
async def get_case(case_id: str, database: Database, _: CurrentPrincipal) -> CaseItem:
    return await _load(database, case_id)


@router.post("/{case_id}/approve", response_model=CaseItem)
async def approve_case(case_id: str, database: Database, principal: CurrentPrincipal) -> CaseItem:
    """Approve the stage currently awaiting a decision."""
    case = await _load(database, case_id)
    now = datetime.now(timezone.utc)
    try:
        updated = approve(case, approver=principal.display_name, at=now)
    except ApprovalError as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail={"error": "invalid_transition", "detail": exc.message},
        ) from exc

    await _persist(database, updated, expected=case)
    event = approval_event(updated, approver=principal.display_name, at=now)
    await database[ACTIVITY].insert_one(event.model_dump(by_alias=True, exclude=ACTIVITY_PERSIST_EXCLUDE))
    return updated


@router.post("/{case_id}/reject", response_model=CaseItem)
async def reject_case(
    case_id: str,
    payload: RejectRequest,
    database: Database,
    principal: CurrentPrincipal,
) -> CaseItem:
    """Reject at the current stage. A reason is mandatory."""
    case = await _load(database, case_id)
    now = datetime.now(timezone.utc)
    try:
        updated = reject(case, approver=principal.display_name, reason=payload.reason, at=now)
    except ApprovalError as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail={"error": "invalid_transition", "detail": exc.message},
        ) from exc

    await _persist(database, updated, expected=case)
    event = rejection_event(updated, approver=principal.display_name, reason=payload.reason, at=now)
    await database[ACTIVITY].insert_one(event.model_dump(by_alias=True, exclude=ACTIVITY_PERSIST_EXCLUDE))
    return updated
