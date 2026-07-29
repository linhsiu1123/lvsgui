"""Approval state machine.

Deliberately free of FastAPI and MongoDB: every rule about what an approval or
rejection does to a document lives here as a pure function over `CaseItem`, so
it can be tested exhaustively without a database. The routers persist whatever
these functions return.

The transitions mirror the console's own optimistic updates in
`components/signagent/viewModel.ts`, so the UI and the server agree.
"""

from __future__ import annotations

from datetime import datetime

from .models import ActivityItem, CaseItem, RouteStep


class ApprovalError(Exception):
    """A transition the document's current state does not allow."""

    def __init__(self, message: str, *, status_code: int = 409) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def current_stage(case: CaseItem) -> RouteStep | None:
    """The stage awaiting a decision, or None when there is nothing pending."""
    if case.status != "pending" or case.route_idx is None:
        return None
    if not 0 <= case.route_idx < len(case.route):
        return None
    return case.route[case.route_idx]


def assert_actionable(case: CaseItem) -> RouteStep:
    """Guard shared by approve and reject."""
    if case.status != "pending":
        raise ApprovalError(f"{case.id} is not awaiting approval (status: {case.status})")
    stage = current_stage(case)
    if stage is None:
        raise ApprovalError(f"{case.id} has no stage awaiting a decision")
    return stage


def approve(case: CaseItem, *, approver: str, at: datetime) -> CaseItem:
    """Mark the current stage done and advance, or complete the approval."""
    assert_actionable(case)
    idx = case.route_idx or 0

    route = [step.model_copy() for step in case.route]
    route[idx].state = "done"

    next_idx = idx + 1
    finished = next_idx >= len(route)
    tail = "approval complete" if finished else f"routed to {route[next_idx].name}"

    return case.model_copy(
        update={
            "route": route,
            "route_idx": next_idx,
            "status": "approved" if finished else "pending",
            "current_level2": not finished,
            "last_event_text": f"{approver} approved, {tail}",
            "last_event_at": at,
        }
    )


def reject(case: CaseItem, *, approver: str, reason: str, at: datetime) -> CaseItem:
    """Reject at the current stage. The reason is required and recorded."""
    assert_actionable(case)
    reason = reason.strip()
    if not reason:
        raise ApprovalError("A rejection reason is required", status_code=422)

    idx = case.route_idx or 0
    route = [step.model_copy() for step in case.route]
    route[idx].state = "rejected"

    return case.model_copy(
        update={
            "route": route,
            "status": "rejected",
            "current_level2": False,
            "last_event_text": f"{approver} rejected: {reason}",
            "last_event_at": at,
        }
    )


def approval_event(case: CaseItem, *, approver: str, at: datetime) -> ActivityItem:
    """Feed entry describing an approval that just landed."""
    finished = case.status == "approved"
    return ActivityItem(
        icon="OK" if finished else "AP",
        chip="green" if finished else "accent",
        text=f"{case.id} approved by {approver}",
        sub="Approval complete" if finished else f"Routed to {case.route[case.route_idx or 0].name}",
        at=at,
    )


def rejection_event(case: CaseItem, *, approver: str, reason: str, at: datetime) -> ActivityItem:
    return ActivityItem(
        icon="RJ",
        chip="amber",
        text=f"{case.id} rejected by {approver}",
        sub=reason,
        at=at,
    )
