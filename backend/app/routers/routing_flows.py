"""Routing rule flows — `/qc/routing-flows`.

The console keys flows by pipeline name ("Pipeline1"), which is also the path
parameter the Next.js proxy passes through on update.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Response, status

from ..db import ROUTING_FLOWS, Database
from ..models import RouteDef
from ..security import CurrentPrincipal

router = APIRouter(prefix="/qc/routing-flows", tags=["routing"])


@router.get("", response_model=dict[str, RouteDef])
async def list_flows(database: Database, _: CurrentPrincipal) -> dict[str, RouteDef]:
    """All flows, shaped as `{ pipelineName: RouteDef }` for the console."""
    cursor = database[ROUTING_FLOWS].find({}, projection={"_id": False})
    return {doc["name"]: RouteDef.model_validate(doc) async for doc in cursor}


@router.put("/{name}", response_model=RouteDef)
async def upsert_flow(
    name: str,
    flow: RouteDef,
    database: Database,
    _: CurrentPrincipal,
) -> RouteDef:
    """Create or replace one pipeline's flow definition."""
    await database[ROUTING_FLOWS].update_one(
        {"name": name},
        {"$set": {"name": name, **flow.model_dump(by_alias=True, exclude_none=True)}},
        upsert=True,
    )
    return flow


@router.delete("/{name}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_flow(name: str, database: Database, _: CurrentPrincipal) -> Response:
    """Remove a pipeline. Used by the console when a flow is renamed."""
    result = await database[ROUTING_FLOWS].delete_one({"name": name})
    if result.deleted_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": "not_found", "detail": f"No routing flow {name}"},
        )
    return Response(status_code=status.HTTP_204_NO_CONTENT)
