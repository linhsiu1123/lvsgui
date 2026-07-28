# LVS QC Approval Backend

FastAPI + MongoDB service behind the Next.js console. Every request arrives from
the console's proxy (`lib/backend.ts`) carrying the caller's Keycloak access
token, which this service validates against the realm's JWKS.

## Run it

```bash
cd backend
python -m venv .venv
.venv/Scripts/python -m pip install -e ".[dev]"    # Linux/macOS: .venv/bin/python
cp .env.example .env
.venv/Scripts/python -m uvicorn app.main:app --reload --port 8000
```

Needs a MongoDB on `MONGODB_URL`. Empty collections are seeded with the same
demo fixtures the console ships with, so the UI has content immediately.

Interactive API docs: <http://localhost:8000/docs>

### Point the console at it

In the repo root's `.env.local`:

```
BACKEND_BASE_URL=http://localhost:8000
```

### Running without Keycloak

Set `AUTH_BYPASS=true` in `backend/.env` — the same switch the frontend has.
Token validation is skipped and actions are attributed to a stub `Debug User`.
It is ignored when `ENVIRONMENT=production`, so it cannot ship by accident.

For the whole stack to work offline, set the bypass on **both** sides:
`AUTH_BYPASS=true` in `.env.local` (console) and in `backend/.env` (this service).

## API

Paths are fixed by `config/services.ts` in the console — changing one side
breaks the other, and `tests/test_api.py` asserts them.

| Method | Path | Purpose |
|---|---|---|
| GET | `/qc/documents?type=` | List approval documents, optionally by product type |
| GET | `/qc/documents/{id}` | One document with its routing progress |
| POST | `/qc/documents/{id}/approve` | Approve the stage awaiting a decision |
| POST | `/qc/documents/{id}/reject` | Reject; body `{ "reason": "..." }`, required |
| GET | `/qc/routing-flows` | All flows, as `{ pipelineName: RouteDef }` |
| PUT | `/qc/routing-flows/{name}` | Create or replace one pipeline's flow |
| GET | `/qc/skills` | Agent skills and their enabled state |
| PATCH | `/qc/skills/{key}` | Toggle a skill; body `{ "enabled": bool }` |
| GET | `/qc/activity?limit=` | Activity feed, newest first |
| GET | `/health` | Liveness. Unauthenticated |

Responses are camelCase (`routeIdx`, `lastEvent`) to match the console's
TypeScript types.

## Layout

```
app/
  config.py     Settings; the AUTH_BYPASS guard
  security.py   Keycloak JWT validation -> Principal
  db.py         AsyncMongoClient, collections, indexes
  models.py     Pydantic models mirroring the console's TS types
  domain.py     Approval state machine — pure, no DB, no FastAPI
  seed.py       Demo fixtures, inserted only into empty collections
  routers/      One module per resource
```

The approval rules live in `domain.py` as pure functions over `CaseItem`, which
is why they can be tested exhaustively without a database — and why the routers
stay thin.

Note: PyMongo's own `AsyncMongoClient` is used, not Motor, which reached
end-of-life in May 2026.

## Tests

```bash
cd backend
.venv/Scripts/python -m pytest -q
```

50 tests, no MongoDB required: the API tests inject an in-memory double
(`tests/fake_mongo.py`) and the token tests sign real RS256 tokens with a
throwaway key, exercising the actual `jwt.decode` path.
