"""The approval state machine — the rules that actually matter."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest

from app.domain import ApprovalError, approve, approval_event, reject
from app.formatting import display_time, strip_time_prefix
from app.models import CaseItem, RouteStep

NOW = datetime(2026, 7, 28, 14, 30, tzinfo=timezone.utc)


def two_stage_case(**overrides) -> CaseItem:
    base = dict(
        id="QC-2606",
        title="Rule Deck Change RD-0981",
        type="Rule Deck Change",
        ver="v2.1",
        submitter="Chen Ya-ting",
        risk="Medium",
        status="pending",
        route_idx=0,
        route=[RouteStep(name="Dep. Mgr. Lin"), RouteStep(name="Assoc. Mgr. Wang")],
    )
    return CaseItem(**{**base, **overrides})


class TestApprove:
    def test_first_of_two_stages_advances_and_stays_pending(self) -> None:
        result = approve(two_stage_case(), approver="Lin", at=NOW)

        assert result.status == "pending"
        assert result.route_idx == 1
        assert result.route[0].state == "done"
        assert result.route[1].state is None
        assert result.current_level2 is True
        assert "routed to Assoc. Mgr. Wang" in result.last_event

    def test_final_stage_completes_the_approval(self) -> None:
        case = two_stage_case(route_idx=1, route=[RouteStep(name="Lin", state="done"), RouteStep(name="Wang")])

        result = approve(case, approver="Wang", at=NOW)

        assert result.status == "approved"
        assert result.route_idx == 2
        assert all(step.state == "done" for step in result.route)
        assert result.current_level2 is False
        assert "approval complete" in result.last_event

    def test_single_stage_case_completes_immediately(self) -> None:
        case = two_stage_case(route=[RouteStep(name="Lin")], route_idx=0)
        assert approve(case, approver="Lin", at=NOW).status == "approved"

    def test_does_not_mutate_the_input(self) -> None:
        case = two_stage_case()
        approve(case, approver="Lin", at=NOW)
        assert case.route_idx == 0
        assert case.route[0].state is None

    @pytest.mark.parametrize("status", ["approved", "rejected", "auto"])
    def test_rejects_documents_that_are_not_pending(self, status: str) -> None:
        with pytest.raises(ApprovalError) as exc:
            approve(two_stage_case(status=status), approver="Lin", at=NOW)
        assert exc.value.status_code == 409

    def test_rejects_a_pending_document_with_no_current_stage(self) -> None:
        case = two_stage_case(route_idx=5)
        with pytest.raises(ApprovalError):
            approve(case, approver="Lin", at=NOW)


class TestReject:
    def test_records_the_reason_and_ends_the_flow(self) -> None:
        result = reject(two_stage_case(), approver="Lin", reason="evidence missing", at=NOW)

        assert result.status == "rejected"
        assert result.route[0].state == "rejected"
        assert result.last_event.endswith("Lin rejected: evidence missing")

    def test_a_blank_reason_is_refused_as_unprocessable(self) -> None:
        with pytest.raises(ApprovalError) as exc:
            reject(two_stage_case(), approver="Lin", reason="   ", at=NOW)
        assert exc.value.status_code == 422

    def test_cannot_reject_an_already_decided_document(self) -> None:
        with pytest.raises(ApprovalError):
            reject(two_stage_case(status="approved"), approver="Lin", reason="nope", at=NOW)


class TestDisplayTime:
    def test_today_and_yesterday_are_named(self) -> None:
        assert display_time(NOW, now=NOW) == "Today 14:30"
        assert display_time(NOW - timedelta(days=1), now=NOW) == "Yesterday 14:30"

    def test_older_dates_fall_back_to_month_day(self) -> None:
        assert display_time(datetime(2026, 7, 3, 11, 5, tzinfo=timezone.utc), now=NOW) == "7/03 11:05"


class TestActivityEvents:
    def test_completed_approval_reads_as_complete(self) -> None:
        case = two_stage_case(route_idx=1, route=[RouteStep(name="Lin", state="done"), RouteStep(name="Wang")])
        event = approval_event(approve(case, approver="Wang", at=NOW), approver="Wang", at=NOW)

        assert event.chip == "green"
        assert event.sub == "Approval complete"

    def test_intermediate_approval_names_the_next_approver(self) -> None:
        event = approval_event(approve(two_stage_case(), approver="Lin", at=NOW), approver="Lin", at=NOW)

        assert event.chip == "accent"
        assert "Assoc. Mgr. Wang" in event.sub
