"""A tiny in-memory stand-in for the async MongoDB API.

Only the operations `app/` actually uses are implemented. This exists so the
API tests exercise the real routers, models and domain code without needing a
MongoDB server; anything beyond the supported subset raises loudly rather than
silently pretending to work.
"""

from __future__ import annotations

import copy
from typing import Any, AsyncIterator, Iterable


def _matches(doc: dict[str, Any], query: dict[str, Any]) -> bool:
    """Equality matching, plus the one operator the migrations use."""
    for key, expected in query.items():
        if isinstance(expected, dict):
            if set(expected) != {"$exists"}:
                raise NotImplementedError(f"FakeCollection cannot match {key}={expected!r}")
            if (key in doc) is not expected["$exists"]:
                return False
            continue
        if not isinstance(expected, (str, int, float, bool, type(None))):
            raise NotImplementedError(f"FakeCollection cannot match {key}={expected!r}")
        if doc.get(key) != expected:
            return False
    return True


def _project(doc: dict[str, Any], projection: dict[str, Any] | None) -> dict[str, Any]:
    out = copy.deepcopy(doc)
    for field, keep in (projection or {}).items():
        if not keep:
            out.pop(field, None)
    return out


class FakeCursor:
    def __init__(self, docs: list[dict[str, Any]]) -> None:
        self._docs = docs

    def sort(self, field: str, direction: int = 1) -> "FakeCursor":
        # None sorts last regardless of direction, mirroring "missing field".
        present = [d for d in self._docs if d.get(field) is not None]
        missing = [d for d in self._docs if d.get(field) is None]
        present.sort(key=lambda d: d[field], reverse=direction < 0)
        self._docs = present + missing
        return self

    def limit(self, n: int) -> "FakeCursor":
        self._docs = self._docs[:n]
        return self

    async def __aiter__(self) -> AsyncIterator[dict[str, Any]]:
        for doc in self._docs:
            yield doc


class FakeUpdateResult:
    def __init__(self, matched: int, modified: int) -> None:
        self.matched_count = matched
        self.modified_count = modified


class FakeDeleteResult:
    def __init__(self, deleted: int) -> None:
        self.deleted_count = deleted


class FakeCollection:
    def __init__(self) -> None:
        self.docs: list[dict[str, Any]] = []

    # ── reads ──
    def find(self, query: dict[str, Any] | None = None, projection: dict[str, Any] | None = None) -> FakeCursor:
        return FakeCursor([_project(d, projection) for d in self.docs if _matches(d, query or {})])

    async def find_one(
        self, query: dict[str, Any], projection: dict[str, Any] | None = None
    ) -> dict[str, Any] | None:
        for doc in self.docs:
            if _matches(doc, query):
                return _project(doc, projection)
        return None

    async def count_documents(self, query: dict[str, Any], limit: int | None = None) -> int:
        hits = [d for d in self.docs if _matches(d, query)]
        return min(len(hits), limit) if limit else len(hits)

    # ── writes ──
    async def insert_one(self, doc: dict[str, Any]) -> None:
        self.docs.append(copy.deepcopy(doc))

    async def insert_many(self, docs: Iterable[dict[str, Any]]) -> None:
        self.docs.extend(copy.deepcopy(d) for d in docs)

    def _apply(self, doc: dict[str, Any], update: dict[str, Any]) -> None:
        unsupported = set(update) - {"$set", "$unset"}
        if unsupported:
            raise NotImplementedError(f"FakeCollection supports only $set/$unset, got {unsupported}")
        doc.update(copy.deepcopy(update.get("$set", {})))
        for field in update.get("$unset", {}):
            doc.pop(field, None)

    async def update_one(
        self, query: dict[str, Any], update: dict[str, Any], upsert: bool = False
    ) -> FakeUpdateResult:
        for doc in self.docs:
            if _matches(doc, query):
                self._apply(doc, update)
                return FakeUpdateResult(1, 1)
        if upsert:
            fresh = dict(query)
            self._apply(fresh, update)
            self.docs.append(fresh)
            return FakeUpdateResult(0, 0)
        return FakeUpdateResult(0, 0)

    async def update_many(self, query: dict[str, Any], update: dict[str, Any]) -> FakeUpdateResult:
        touched = 0
        for doc in self.docs:
            if _matches(doc, query):
                self._apply(doc, update)
                touched += 1
        return FakeUpdateResult(touched, touched)

    async def find_one_and_update(
        self,
        query: dict[str, Any],
        update: dict[str, Any],
        projection: dict[str, Any] | None = None,
        return_document: Any = False,
    ) -> dict[str, Any] | None:
        for doc in self.docs:
            if _matches(doc, query):
                before = copy.deepcopy(doc)
                self._apply(doc, update)
                return _project(doc if return_document else before, projection)
        return None

    async def delete_one(self, query: dict[str, Any]) -> "FakeDeleteResult":
        for i, doc in enumerate(self.docs):
            if _matches(doc, query):
                del self.docs[i]
                return FakeDeleteResult(1)
        return FakeDeleteResult(0)

    async def create_index(self, *_: Any, **__: Any) -> None:
        return None


class FakeDatabase:
    def __init__(self) -> None:
        self._collections: dict[str, FakeCollection] = {}

    def __getitem__(self, name: str) -> FakeCollection:
        return self._collections.setdefault(name, FakeCollection())
