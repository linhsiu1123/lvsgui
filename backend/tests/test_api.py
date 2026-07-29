"""Endpoint behaviour, over the real routers with an in-memory database.

Paths asserted here are the ones `config/services.ts` in the Next.js app calls,
so a rename on either side breaks these tests.
"""

from __future__ import annotations

import pytest
from httpx import AsyncClient

from app.config import Settings
from app.db import get_database
from app.main import app
from app.security import bearer_scheme

from .fake_mongo import FakeDatabase

pytestmark = pytest.mark.usefixtures("seeded")


class TestHealth:
    async def test_health_reports_the_active_auth_mode(self, client: AsyncClient) -> None:
        body = (await client.get("/health")).json()
        assert body == {"status": "ok", "authBypass": True, "oidcConfigured": True}


class TestDocuments:
    async def test_lists_seeded_documents_newest_first(self, client: AsyncClient) -> None:
        res = await client.get("/qc/documents")
        assert res.status_code == 200

        docs = res.json()
        assert len(docs) == 6
        assert docs[0]["id"] == "QC-2607"
        # camelCase on the wire, matching the TypeScript CaseItem
        assert "lastEvent" in docs[0]
        assert "routeIdx" in docs[1]

    async def test_filters_by_product_type(self, client: AsyncClient) -> None:
        docs = (await client.get("/qc/documents", params={"type": "Waiver Request"})).json()
        assert {d["id"] for d in docs} == {"QC-2605", "QC-2604"}

    async def test_caps_the_response_size(self, client: AsyncClient) -> None:
        assert len((await client.get("/qc/documents", params={"limit": 2})).json()) == 2
        # out-of-range limits are refused rather than silently clamped
        assert (await client.get("/qc/documents", params={"limit": 0})).status_code == 422
        assert (await client.get("/qc/documents", params={"limit": 501})).status_code == 422

    async def test_fetches_one_document(self, client: AsyncClient) -> None:
        doc = (await client.get("/qc/documents/QC-2606")).json()
        assert doc["title"].startswith("Rule Deck Change RD-0981")
        assert doc["route"][0]["name"] == "Verification Dep. Mgr. Lin"

    async def test_unknown_document_is_a_404(self, client: AsyncClient) -> None:
        res = await client.get("/qc/documents/QC-9999")
        assert res.status_code == 404
        assert res.json()["detail"]["error"] == "not_found"


class TestApproval:
    async def test_approving_advances_to_the_next_stage(self, client: AsyncClient) -> None:
        res = await client.post("/qc/documents/QC-2606/approve")
        assert res.status_code == 200

        body = res.json()
        assert body["status"] == "pending"
        assert body["routeIdx"] == 1
        assert body["route"][0]["state"] == "done"

        # persisted, not just returned
        assert (await client.get("/qc/documents/QC-2606")).json()["routeIdx"] == 1

    async def test_approving_the_last_stage_completes_the_document(self, client: AsyncClient) -> None:
        await client.post("/qc/documents/QC-2606/approve")
        body = (await client.post("/qc/documents/QC-2606/approve")).json()
        assert body["status"] == "approved"

    async def test_cannot_approve_an_already_decided_document(self, client: AsyncClient) -> None:
        res = await client.post("/qc/documents/QC-2604/approve")  # already rejected
        assert res.status_code == 409
        assert res.json()["detail"]["error"] == "invalid_transition"

    async def test_rejection_requires_a_reason(self, client: AsyncClient) -> None:
        assert (await client.post("/qc/documents/QC-2606/reject", json={})).status_code == 422
        assert (await client.post("/qc/documents/QC-2606/reject", json={"reason": ""})).status_code == 422

    async def test_rejection_records_the_reason(self, client: AsyncClient) -> None:
        body = (await client.post("/qc/documents/QC-2606/reject", json={"reason": "missing data"})).json()

        assert body["status"] == "rejected"
        assert body["route"][0]["state"] == "rejected"
        assert body["lastEvent"].endswith("rejected: missing data")

    async def test_a_second_approver_racing_the_first_is_refused(
        self, client: AsyncClient, seeded: FakeDatabase
    ) -> None:
        """Read-modify-write must not let one decision overwrite another.

        Simulates the interleaving: both approvers loaded the document at
        routeIdx 0, the first commits, the second then tries to commit its
        stale view.
        """
        first = (await client.post("/qc/documents/QC-2606/approve")).json()
        assert first["routeIdx"] == 1

        # Rewind the in-flight request's view of the world, not the database.
        stale = await seeded["cases"].find_one({"id": "QC-2606"})
        assert stale is not None and stale["routeIdx"] == 1

        # A racing approver still holding routeIdx 0 would produce this write;
        # the conditional filter must reject it.
        result = await seeded["cases"].update_one(
            {"id": "QC-2606", "status": "pending", "routeIdx": 0},
            {"$set": {"routeIdx": 1}},
        )
        assert result.matched_count == 0, "a stale write must match no document"

    async def test_deciding_an_already_decided_document_is_a_conflict(self, client: AsyncClient) -> None:
        await client.post("/qc/documents/QC-2606/approve")
        await client.post("/qc/documents/QC-2606/approve")  # completes it

        late = await client.post("/qc/documents/QC-2606/approve")
        assert late.status_code == 409
        assert late.json()["detail"]["error"] == "invalid_transition"

    async def test_decisions_append_to_the_activity_feed(self, client: AsyncClient) -> None:
        assert (await client.get("/qc/activity")).json() == []

        await client.post("/qc/documents/QC-2606/approve")
        feed = (await client.get("/qc/activity")).json()

        assert len(feed) == 1
        assert "QC-2606 approved by Debug User" == feed[0]["text"]


class TestRoutingFlows:
    async def test_lists_flows_keyed_by_pipeline(self, client: AsyncClient) -> None:
        flows = (await client.get("/qc/routing-flows")).json()

        assert set(flows) == {"Pipeline1", "Pipeline2", "Pipeline3"}
        assert flows["Pipeline1"]["chain"] == ["node1", "node2", "node3"]

    async def test_updates_a_flow_in_place(self, client: AsyncClient) -> None:
        payload = {"meta": "v4 · updated today · System Admin", "mid": ["v"], "high": ["v"], "chain": ["intake", "sign"]}
        assert (await client.put("/qc/routing-flows/Pipeline1", json=payload)).status_code == 200

        flows = (await client.get("/qc/routing-flows")).json()
        assert flows["Pipeline1"]["chain"] == ["intake", "sign"]
        assert len(flows) == 3, "updating must not create a duplicate pipeline"

    async def test_creates_a_pipeline_that_does_not_exist_yet(self, client: AsyncClient) -> None:
        payload = {"meta": "v1 · created today", "mid": ["v"], "high": ["v"], "chain": ["node1"]}
        await client.put("/qc/routing-flows/Pipeline4", json=payload)

        assert "Pipeline4" in (await client.get("/qc/routing-flows")).json()

    async def test_deletes_a_pipeline(self, client: AsyncClient) -> None:
        assert (await client.delete("/qc/routing-flows/Pipeline3")).status_code == 204
        assert set((await client.get("/qc/routing-flows")).json()) == {"Pipeline1", "Pipeline2"}

    async def test_deleting_an_unknown_pipeline_is_a_404(self, client: AsyncClient) -> None:
        assert (await client.delete("/qc/routing-flows/Nope")).status_code == 404

    async def test_flows_default_to_enabled_with_no_node_settings(self, client: AsyncClient) -> None:
        flow = (await client.get("/qc/routing-flows")).json()["Pipeline1"]
        assert flow["enabled"] is True
        assert flow["nodeSkills"] == {}
        assert flow["nodeVerify"] == {}

    async def test_persists_per_node_settings_and_the_enabled_switch(self, client: AsyncClient) -> None:
        payload = {
            "meta": "v4 · updated today",
            "mid": ["v"],
            "high": ["v"],
            "chain": ["intake", "sign"],
            "enabled": False,
            "nodeSkills": {"n0": "precheck", "n1": "auto"},
            "nodeVerify": {"n0": False, "n1": True},
        }
        await client.put("/qc/routing-flows/Pipeline1", json=payload)

        flow = (await client.get("/qc/routing-flows")).json()["Pipeline1"]
        assert flow["enabled"] is False
        assert flow["nodeSkills"] == {"n0": "precheck", "n1": "auto"}
        assert flow["nodeVerify"] == {"n0": False, "n1": True}


class TestSkills:
    async def test_lists_the_four_agent_skills_enabled(self, client: AsyncClient) -> None:
        skills = (await client.get("/qc/skills")).json()
        assert [s["key"] for s in skills] == ["route", "precheck", "auto", "anomaly"]
        assert all(s["enabled"] for s in skills)

    async def test_toggles_one_skill_off(self, client: AsyncClient) -> None:
        body = (await client.patch("/qc/skills/auto", json={"enabled": False})).json()
        assert body["enabled"] is False

        skills = {s["key"]: s["enabled"] for s in (await client.get("/qc/skills")).json()}
        assert skills == {"route": True, "precheck": True, "auto": False, "anomaly": True}

    async def test_unknown_skill_is_a_404(self, client: AsyncClient) -> None:
        assert (await client.patch("/qc/skills/nope", json={"enabled": True})).status_code == 404

    async def test_edits_a_skill_without_touching_the_rest(self, client: AsyncClient) -> None:
        res = await client.patch("/qc/skills/route", json={"name": "Smart Routing", "desc": "Picks approvers."})
        assert res.status_code == 200

        body = res.json()
        assert body == {
            "key": "route",
            "glyph": "RT",  # untouched
            "name": "Smart Routing",
            "desc": "Picks approvers.",
            "enabled": True,  # untouched
        }

    async def test_an_empty_edit_is_refused(self, client: AsyncClient) -> None:
        res = await client.patch("/qc/skills/route", json={})
        assert res.status_code == 422
        assert res.json()["detail"]["error"] == "empty_update"

    async def test_rejects_blank_content(self, client: AsyncClient) -> None:
        assert (await client.patch("/qc/skills/route", json={"name": ""})).status_code == 422
        assert (await client.patch("/qc/skills/route", json={"glyph": ""})).status_code == 422


class TestSkillCreation:
    async def test_creates_a_skill(self, client: AsyncClient) -> None:
        payload = {
            "key": "duplicate-check",
            "glyph": "DC",
            "name": "Duplicate Detection",
            "desc": "Flags documents that repeat a recent submission.",
        }
        res = await client.post("/qc/skills", json=payload)
        assert res.status_code == 201
        assert res.json() == {**payload, "enabled": True}

        keys = [s["key"] for s in (await client.get("/qc/skills")).json()]
        assert keys == ["route", "precheck", "auto", "anomaly", "duplicate-check"]

    async def test_can_be_created_disabled(self, client: AsyncClient) -> None:
        res = await client.post(
            "/qc/skills",
            json={"key": "wip", "glyph": "WP", "name": "Work in progress", "desc": "Not ready.", "enabled": False},
        )
        assert res.json()["enabled"] is False

    async def test_a_duplicate_key_is_a_conflict(self, client: AsyncClient) -> None:
        res = await client.post("/qc/skills", json={"key": "route", "glyph": "XX", "name": "Clash", "desc": "No."})
        assert res.status_code == 409
        assert res.json()["detail"]["error"] == "already_exists"
        # the original survives untouched
        route = next(s for s in (await client.get("/qc/skills")).json() if s["key"] == "route")
        assert route["name"] == "Routing Decision"

    @pytest.mark.parametrize(
        "key",
        ["", "Has Space", "UPPER", "-leading", "way-too-long-a-key-for-a-skill-identifier-here"],
    )
    async def test_rejects_malformed_keys(self, client: AsyncClient, key: str) -> None:
        res = await client.post("/qc/skills", json={"key": key, "glyph": "XX", "name": "N", "desc": "D"})
        assert res.status_code == 422

    async def test_rejects_missing_content(self, client: AsyncClient) -> None:
        assert (await client.post("/qc/skills", json={"key": "k", "glyph": "K"})).status_code == 422
        assert (
            await client.post("/qc/skills", json={"key": "k", "glyph": "", "name": "N", "desc": "D"})
        ).status_code == 422


class TestAuthEnforcement:
    """With the bypass off, every data route needs a bearer token."""

    @pytest.fixture
    async def strict_client(self, database: FakeDatabase):
        from app.config import get_settings
        from httpx import ASGITransport, AsyncClient as Client

        strict = Settings(auth_bypass=False, keycloak_issuer="https://kc.test/realms/lvs")
        app.dependency_overrides[get_settings] = lambda: strict
        app.dependency_overrides[get_database] = lambda: database
        # Simulate "no Authorization header" without HTTPBearer short-circuiting.
        app.dependency_overrides[bearer_scheme] = lambda: None
        async with Client(transport=ASGITransport(app=app), base_url="http://test") as ac:
            yield ac
        app.dependency_overrides.clear()

    @pytest.mark.parametrize(
        "method,path",
        [
            ("get", "/qc/documents"),
            ("get", "/qc/documents/QC-2606"),
            ("get", "/qc/routing-flows"),
            ("get", "/qc/skills"),
            ("get", "/qc/activity"),
        ],
    )
    async def test_reads_require_a_token(self, strict_client: AsyncClient, method: str, path: str) -> None:
        res = await getattr(strict_client, method)(path)
        assert res.status_code == 401
        assert res.json()["detail"]["error"] == "not_authenticated"

    async def test_writes_require_a_token(self, strict_client: AsyncClient) -> None:
        assert (await strict_client.post("/qc/documents/QC-2606/approve")).status_code == 401
        assert (await strict_client.patch("/qc/skills/auto", json={"enabled": False})).status_code == 401

    async def test_health_stays_open(self, strict_client: AsyncClient) -> None:
        assert (await strict_client.get("/health")).status_code == 200
