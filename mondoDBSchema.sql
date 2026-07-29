-- =====================================================================
--  LVS QC Approval — MongoDB schema, rendered as SQL DDL
-- =====================================================================
--
--  READ THIS FIRST
--
--  MongoDB has no DDL. Collections are schemaless at the storage layer and
--  the real contract is enforced in application code, not the database.
--  This file is therefore DOCUMENTATION, not a migration:
--
--    * It CANNOT be executed against MongoDB.
--    * Executing it against PostgreSQL/MySQL produces an equivalent
--      relational model — useful for BI tools, ER diagrams and review, but
--      it is not what the application talks to.
--
--  The authoritative schema is the Pydantic model set:
--      backend/app/models.py          field names, types, required-ness
--      backend/app/db.py              collections and indexes
--      backend/app/seed.py            initial contents
--
--  Field names below are the ON-THE-WIRE names (camelCase). Python uses
--  snake_case internally; Pydantic aliases across the boundary.
--
--  Generated from a live introspection of database `lvsqc`
--  (MongoDB 8.3.7) cross-checked against the models.
--
-- ---------------------------------------------------------------------
--  MAPPING CONVENTIONS
-- ---------------------------------------------------------------------
--    collection                  -> table
--    business key (id/name/key)  -> PRIMARY KEY (Mongo's _id is an
--                                   implementation detail and is never
--                                   exposed by the API; every read
--                                   projects it away)
--    embedded array of objects   -> child table + ordinal column, because
--                                   document order is significant
--    array of scalars            -> child table + ordinal column
--    object with dynamic keys    -> key/value child table
--    enum-ish string             -> CHECK constraint
--
--  Dialect: PostgreSQL. TIMESTAMPTZ maps to BSON UTC datetime.
-- =====================================================================


-- =====================================================================
--  cases  — approval documents
-- =====================================================================
--  The unit of work: one document moving through an approval route.
--  Written by the seeder and by the approve/reject endpoints.
CREATE TABLE cases (
    -- Business key shown throughout the UI, e.g. 'QC-2606'.
    id              VARCHAR(32)  NOT NULL,

    title           TEXT         NOT NULL,   -- 'Rule Deck Change RD-0981 M0 device compare'
    -- Product type. Maps to a pipeline via TYPE_DEFS in the frontend;
    -- deliberately NOT a foreign key to routing_flows (see note below).
    type            VARCHAR(64)  NOT NULL,   -- 'Rule Deck Change'
    ver             VARCHAR(16)  NOT NULL,   -- 'v2.1'
    submitter       VARCHAR(128) NOT NULL,   -- owner engineer

    -- Agent-assigned alert level. Low carries no badge in the UI;
    -- Medium renders as "Warning", High as "Error".
    risk            VARCHAR(8)   NOT NULL,
    status          VARCHAR(16)  NOT NULL,

    -- Index into case_route_steps.ordinal for the stage awaiting a
    -- decision. NULL for documents that never had a manual route.
    -- Advances past the last stage when the approval completes, so it may
    -- exceed the highest ordinal.
    "routeIdx"      INTEGER          NULL,

    -- True while a multi-level approval is in flight past level 1. Drives
    -- the "awaiting me" filter on the Pending Items queue.
    "currentLevel2" BOOLEAN          NULL,

    -- Audit line, stored WITHOUT any rendered timestamp.
    -- 'Debug User approved, approval complete'
    "lastEventText" TEXT         NOT NULL,
    -- When that event happened. The API composes
    -- "<rendered lastEventAt> · <lastEventText>" at read time.
    "lastEventAt"   TIMESTAMPTZ      NULL,

    -- The real submission timestamp. Stored as a tz-aware BSON date; this is
    -- what the list endpoint sorts on (descending), and what the API renders
    -- into the relative `time` string it returns.
    "submittedAt"   TIMESTAMPTZ      NULL,

    -- NOTE  There is deliberately no stored `time` or `lastEvent` column.
    --       Earlier versions persisted the rendered strings ("Today 09:12"),
    --       which silently became wrong the moment the day rolled over. Both
    --       are now derived on read from the timestamps above; see
    --       app/formatting.py and the computed fields in app/models.py.

    CONSTRAINT pk_cases PRIMARY KEY (id),
    CONSTRAINT ck_cases_risk   CHECK (risk   IN ('Low', 'Medium', 'High')),
    CONSTRAINT ck_cases_status CHECK (status IN ('auto', 'pending', 'approved', 'rejected'))
);

-- { id: 1 }, unique — the business key; every lookup goes through it.
CREATE UNIQUE INDEX ux_cases_id ON cases (id);
-- { type: 1 } — backs GET /qc/documents?type=...
CREATE INDEX ix_cases_type ON cases (type);

--  NOTE  cases.type is not a foreign key on purpose. A document's type is
--  historical fact; pipelines can be renamed or deleted without rewriting
--  or invalidating past approvals.


-- =====================================================================
--  cases.route[]  — embedded approval stages
-- =====================================================================
--  Stored inline on the case document, never queried independently.
--  Order is the approval order, so the ordinal is part of the identity.
CREATE TABLE case_route_steps (
    case_id     VARCHAR(32)  NOT NULL,
    ordinal     INTEGER      NOT NULL,   -- 0-based; cases."routeIdx" points here

    -- Approver title, or 'Agent Auto-approve' for the automated path.
    name        VARCHAR(128) NOT NULL,

    -- NULL  = not yet decided (pending or not reached)
    -- 'done'     = approved at this stage
    -- 'rejected' = rejected here; the route stops
    state       VARCHAR(16)      NULL,

    CONSTRAINT pk_case_route_steps PRIMARY KEY (case_id, ordinal),
    CONSTRAINT fk_case_route_steps_case
        FOREIGN KEY (case_id) REFERENCES cases (id) ON DELETE CASCADE,
    CONSTRAINT ck_case_route_steps_state CHECK (state IS NULL OR state IN ('done', 'rejected'))
);


-- =====================================================================
--  routing_flows  — routing rule pipelines
-- =====================================================================
--  One document per pipeline. The console's canvas edits this and PUTs
--  the whole document back, so partial updates never occur.
CREATE TABLE routing_flows (
    -- Pipeline name and business key, e.g. 'Pipeline1'. Renaming is
    -- implemented as create-then-delete, so this really is the identity.
    name          VARCHAR(64)  NOT NULL,

    -- Free-text provenance line shown beside the tabs.
    -- 'v3 · updated 6/28 · System Admin'. Bumped on every edit.
    meta          TEXT         NOT NULL,

    -- Whether the whole rule is active (canvas toolbar switch).
    -- See DATA NOTE 1: absent on documents seeded before this was added.
    enabled       BOOLEAN      NOT NULL DEFAULT TRUE,

    CONSTRAINT pk_routing_flows PRIMARY KEY (name)
);

-- { name: 1 }, unique
CREATE UNIQUE INDEX ux_routing_flows_name ON routing_flows (name);


-- =====================================================================
--  routing_flows.chain[]  — the ordered flow nodes
-- =====================================================================
--  The current canvas model: a linear chain of freely named steps.
--  Node identity in nodeSkills/nodeVerify is POSITIONAL — 'n0' is
--  ordinal 0 — so deleting a node reindexes the settings of everything
--  after it. See DATA NOTE 2.
CREATE TABLE routing_flow_chain (
    flow_name   VARCHAR(64)  NOT NULL,
    ordinal     INTEGER      NOT NULL,   -- 0-based; node id is 'n' || ordinal
    node_name   VARCHAR(128) NOT NULL,   -- user-editable label, e.g. 'Manager Review'

    CONSTRAINT pk_routing_flow_chain PRIMARY KEY (flow_name, ordinal),
    CONSTRAINT fk_routing_flow_chain_flow
        FOREIGN KEY (flow_name) REFERENCES routing_flows (name) ON DELETE CASCADE
);


-- =====================================================================
--  routing_flows.nodeSkills{} + nodeVerify{}  — per-node settings
-- =====================================================================
--  Two dynamic-key objects in the document, keyed by node id ('n0'...).
--  Folded into one table here since they share a key space. Absent keys
--  mean "default": no skill bound, and human verification required.
CREATE TABLE routing_flow_node_settings (
    flow_name   VARCHAR(64) NOT NULL,
    node_id     VARCHAR(16) NOT NULL,   -- 'n0', 'n1', ... = 'n' || chain ordinal

    -- Agent skill bound to this step; references skills.key.
    -- NULL / absent = no skill assigned. 'anomaly' is never offered here
    -- because it runs across the queue rather than at one step.
    skill_key   VARCHAR(32)     NULL,

    -- Whether this step needs a human confirmation. Absent = TRUE.
    human_verify BOOLEAN        NULL,

    CONSTRAINT pk_routing_flow_node_settings PRIMARY KEY (flow_name, node_id),
    CONSTRAINT fk_rfns_flow
        FOREIGN KEY (flow_name) REFERENCES routing_flows (name) ON DELETE CASCADE,
    CONSTRAINT fk_rfns_skill
        FOREIGN KEY (skill_key) REFERENCES skills (key) ON DELETE SET NULL
);


-- =====================================================================
--  routing_flows.mid[] + high[]  — legacy per-risk approver chains
-- =====================================================================
--  Predates the freeform node chain. Still carried on every pipeline and
--  still round-tripped by the API, but nothing in the current UI reads
--  them. Kept for compatibility; candidates for removal.
CREATE TABLE routing_flow_approver_chain (
    flow_name    VARCHAR(64) NOT NULL,
    branch       VARCHAR(8)  NOT NULL,   -- 'mid' (Medium risk) | 'high' (High risk)
    ordinal      INTEGER     NOT NULL,   -- approval level, 0-based
    -- Approver role code: v = Verification Dep. Mgr.
    --                     d = Design Center Assoc. Mgr.
    --                     g = General Manager
    --                     q = QA Dept. Mgr.
    approver_key VARCHAR(8)  NOT NULL,

    CONSTRAINT pk_rfac PRIMARY KEY (flow_name, branch, ordinal),
    CONSTRAINT fk_rfac_flow
        FOREIGN KEY (flow_name) REFERENCES routing_flows (name) ON DELETE CASCADE,
    CONSTRAINT ck_rfac_branch CHECK (branch IN ('mid', 'high'))
);


-- =====================================================================
--  routing_flows.removed[] + cfg{}  — dormant fields
-- =====================================================================
--  `removed` (array of node ids) and `cfg` (nested per-node config) are
--  declared on the model and preserved on round-trip, but nothing writes
--  them under the current flow model. No table is modelled for them;
--  treat them as reserved.


-- =====================================================================
--  skills  — agent capabilities
-- =====================================================================
--  A small fixed catalogue. Seeded once; only `enabled` changes at
--  runtime, via PATCH /qc/skills/{key}.
CREATE TABLE skills (
    key      VARCHAR(32)  NOT NULL,   -- 'route' | 'precheck' | 'auto' | 'anomaly'
    glyph    VARCHAR(8)   NOT NULL,   -- 2-letter badge drawn in the UI, e.g. 'RT'
    name     VARCHAR(128) NOT NULL,   -- 'Routing Decision'
    desc     TEXT         NOT NULL,   -- one-paragraph explanation
    enabled  BOOLEAN      NOT NULL DEFAULT TRUE,

    CONSTRAINT pk_skills PRIMARY KEY (key)
);

-- { key: 1 }, unique
CREATE UNIQUE INDEX ux_skills_key ON skills (key);


-- =====================================================================
--  activity  — agent activity feed
-- =====================================================================
--  Append-only event log. Written by the approve/reject endpoints and
--  polled by the console every 15s. Nothing deletes from it, so it grows
--  without bound — see DATA NOTE 3.
CREATE TABLE activity (
    -- No business key: entries are anonymous events. Mongo's _id is the
    -- only identity, and the API never exposes it. A surrogate is added
    -- here purely so the relational rendering is well-formed.
    event_id  BIGSERIAL   NOT NULL,

    icon      VARCHAR(8)  NOT NULL,   -- 2-letter chip: 'AP', 'OK', 'RJ', ...
    chip      VARCHAR(16) NOT NULL,   -- colour role, not a colour value
    text      TEXT        NOT NULL,   -- 'QC-2606 approved by Debug User'
    sub       TEXT        NOT NULL,   -- secondary line; '' when there is none
    at        TIMESTAMPTZ     NULL,   -- real timestamp; sort key, and the
                                      -- source of the 'HH:MM' the API returns

    CONSTRAINT pk_activity PRIMARY KEY (event_id),
    CONSTRAINT ck_activity_chip CHECK (chip IN ('accent', 'amber', 'green'))
);

-- { at: -1 } — the feed is always read newest-first.
CREATE INDEX ix_activity_at_desc ON activity (at DESC);


-- =====================================================================
--  DATA NOTES — observed in the live database, not just the model
-- =====================================================================
--
--  1. PARTIALLY POPULATED FIELDS — RESOLVED
--     `enabled`, `nodeSkills` and `nodeVerify` were added to RouteDef
--     after the demo data was first seeded, and seeding only fills EMPTY
--     collections, so older pipelines lacked them. This is now handled by
--     `backfill_flow_defaults` in app/migrations.py, which runs at every
--     startup and is idempotent. New fields added later should get a
--     migration there rather than relying on reader-side defaults.
--
--  2. POSITIONAL NODE IDS
--     nodeSkills/nodeVerify are keyed 'n0', 'n1', ... by CHAIN POSITION,
--     not by a stable node identity. Deleting or inserting a node shifts
--     every later node's settings onto its neighbour. Renaming a node is
--     safe; reordering is not. Giving nodes real ids would fix this and
--     is the single most valuable change to this schema.
--
--  3. UNBOUNDED GROWTH — OPT-IN CONTROL
--     `activity` is append-only. Retention is off by default (keeping
--     history is the safer default); set ACTIVITY_RETENTION_DAYS to a
--     positive number and app/db.py installs a TTL index on `at`, after
--     which MongoDB expires older entries. Turning it on deletes data.
--
--  4. DENORMALISED DISPLAY STRINGS — LARGELY RESOLVED
--     cases."time"/"lastEvent" and activity."time" used to be stored and
--     went stale as soon as the day changed. They are now derived on read
--     from "submittedAt"/"lastEventAt"/"at" and are not columns any more.
--     routing_flows.meta is still a stored free-text provenance line: it
--     is authored text, not a rendered timestamp, so it does not rot the
--     same way — but never sort or filter on it.
--
--  5. NO CROSS-DOCUMENT TRANSACTIONS
--     Approving a case writes the case document and appends an activity
--     event as two separate operations, outside a transaction. A crash
--     between them loses the feed entry while the approval stands. This
--     is acceptable because the feed is advisory and the case's own
--     lastEventText/lastEventAt carry the authoritative audit line.
--
--  6. OPTIMISTIC CONCURRENCY ON DECISIONS
--     Approve/reject is read-modify-write. The write filters on the
--     (status, routeIdx) pair that was read, so a second approver racing
--     on the same stage matches no document and gets 409 rather than
--     silently overwriting the first decision. Any new mutation of
--     `cases` should follow the same pattern.
-- =====================================================================
