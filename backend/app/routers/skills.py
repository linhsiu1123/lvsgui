"""Agent skills — `/qc/skills`."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, status
from pymongo import ReturnDocument

from ..db import SKILLS, Database
from ..models import SkillCreateRequest, SkillDef, SkillUpdateRequest
from ..security import CurrentPrincipal

router = APIRouter(prefix="/qc/skills", tags=["skills"])


@router.get("", response_model=list[SkillDef])
async def list_skills(database: Database, _: CurrentPrincipal) -> list[SkillDef]:
    cursor = database[SKILLS].find({}, projection={"_id": False})
    return [SkillDef.model_validate(doc) async for doc in cursor]


@router.post("", response_model=SkillDef, status_code=status.HTTP_201_CREATED)
async def create_skill(
    payload: SkillCreateRequest,
    database: Database,
    _: CurrentPrincipal,
) -> SkillDef:
    """Add a skill. The key is the identity flow nodes bind to, so it must
    be free — a silent overwrite would silently rebind existing nodes."""
    if await database[SKILLS].find_one({"key": payload.key}, projection={"_id": False}) is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"error": "already_exists", "detail": f"A skill with key {payload.key!r} already exists"},
        )

    skill = SkillDef.model_validate(payload.model_dump(by_alias=True))
    await database[SKILLS].insert_one(skill.model_dump(by_alias=True))
    return skill


@router.patch("/{key}", response_model=SkillDef)
async def update_skill(
    key: str,
    payload: SkillUpdateRequest,
    database: Database,
    _: CurrentPrincipal,
) -> SkillDef:
    """Edit a skill's content and/or its enabled state.

    Partial: only the fields present in the body change. The key itself is
    immutable — renaming it would orphan every flow node bound to it.
    """
    changes = payload.changes()
    if not changes:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail={"error": "empty_update", "detail": "Provide at least one field to change"},
        )

    doc = await database[SKILLS].find_one_and_update(
        {"key": key},
        {"$set": changes},
        projection={"_id": False},
        return_document=ReturnDocument.AFTER,
    )
    if doc is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": "not_found", "detail": f"No skill {key}"},
        )
    return SkillDef.model_validate(doc)
