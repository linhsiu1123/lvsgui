-- =====================================================================
--  LVS QC Approval — fixture data, rendered as SQL DML
-- =====================================================================
--
--  READ THIS FIRST
--
--  Companion to mondoDBSchema.sql, and subject to the same caveat: MongoDB
--  has no DML, so this file CANNOT be executed against MongoDB. It is a
--  portable, reviewable fixture:
--
--    * Run it against PostgreSQL (after mondoDBSchema.sql) for a working
--      relational copy — useful for BI, reporting and query prototyping.
--    * Read it as the canonical description of what a populated database
--      looks like.
--
--  The RUNNABLE seed for MongoDB is backend/app/seed.py, which the backend
--  applies automatically to empty collections at startup. To reload it:
--
--      # wipe, then restart the backend to re-seed
--      mongosh --eval "db.getSiblingDB('lvsqc').dropDatabase()"
--
--  This fixture is deliberately RICHER than seed.py: it covers every status
--  and both approval levels, so the Pending Items queue is non-empty and
--  multi-level routing can be exercised.
--
-- ---------------------------------------------------------------------
--  TIMESTAMPS
-- ---------------------------------------------------------------------
--  Every timestamp is relative (`now() - interval '...'`), never a literal.
--  That is the same rule the application follows: only real timestamps are
--  stored, and the relative strings the console shows ("Today 09:12") are
--  derived at read time. A fixture with hard-coded dates would drift into
--  looking stale exactly the way the old stored-string bug did.
--
--  Load order matters — children reference parents.
--  Dialect: PostgreSQL.
-- =====================================================================

BEGIN;

-- Idempotent: safe to re-run. Children first, then parents.
DELETE FROM activity;
DELETE FROM routing_flow_node_settings;
DELETE FROM routing_flow_chain;
DELETE FROM routing_flow_approver_chain;
DELETE FROM case_route_steps;
DELETE FROM routing_flows;
DELETE FROM cases;
DELETE FROM skills;


-- =====================================================================
--  skills — the agent capability catalogue
-- =====================================================================
--  The four built-ins plus one operator-created skill, to exercise the
--  "skills are data, not code" path. `anomaly` is the only one the flow
--  canvas withholds from node binding (it runs across the queue).
INSERT INTO skills (key, glyph, name, "desc", enabled) VALUES
  ('route',    'RT', 'Routing Decision',
   'Automatically decides which managers and how many approval levels based on doc type and risk.', TRUE),
  ('precheck', 'PR', 'Pre-review & Recommendation',
   'Checks format, attachments, version, and linked ECO before routing, with an approve/reject recommendation.', TRUE),
  ('auto',     'OK', 'Low-risk Auto-approve',
   'Low-risk requests skip manual approval; audited afterward by the approval lead (20% sampling).', TRUE),
  ('anomaly',  'AL', 'Anomaly Detection',
   'Watches for resubmissions, mismatched attachments, and routing bypasses; alerts the approval lead in real time.', TRUE),
  -- operator-created, and deliberately disabled to cover that state
  ('duplicate-check', 'DC', 'Duplicate Detection',
   'Flags documents that repeat a recent submission from the same engineer.', FALSE);


-- =====================================================================
--  cases — approval documents
-- =====================================================================
--  Coverage map:
--    pending, routeIdx 0            -> QC-2611, QC-2610, QC-2609  (the queue)
--    pending, routeIdx 1 (level 2)  -> QC-2608
--    auto (agent-approved)          -> QC-2607, QC-2603
--    approved (fully signed off)    -> QC-2606, QC-2602
--    rejected                       -> QC-2605, QC-2604
--    High risk, 3 levels            -> QC-2609
--
--  `lastEventText` carries NO rendered timestamp — the API composes
--  "<rendered lastEventAt> · <lastEventText>" on read.
INSERT INTO cases
  (id, title, type, ver, submitter, risk, status, "routeIdx", "currentLevel2", "lastEventText", "lastEventAt", "submittedAt")
VALUES
  -- ── awaiting level-1 approval: these populate Pending Items ──
  ('QC-2611', 'Rule Deck Change RD-1042 M2 antenna check', 'Rule Deck Change',        'v1.0',
   'Chen Ya-ting',    'Medium', 'pending', 0, FALSE,
   'Agent pre-review done, routed to Verification Dep. Mgr. Lin',
   now() - interval '2 hours',  now() - interval '2 hours'),

  ('QC-2610', 'Waiver Request WV-0355 metal density', 'Waiver Request',               'v1.0',
   'Liu Chien-hung',  'Medium', 'pending', 0, FALSE,
   'Agent flagged a linked ECO still in progress',
   now() - interval '6 hours',  now() - interval '6 hours'),

  ('QC-2609', 'Rule Deck Change RD-1038 full-chip merge', 'Rule Deck Change',         'v3.0',
   'Wu Meng-chun',    'High',   'pending', 0, FALSE,
   'Agent graded High risk, routed to 3 levels of manual approval',
   now() - interval '1 day' - interval '3 hours',
   now() - interval '1 day' - interval '3 hours'),

  -- ── level 1 signed off, now awaiting level 2 ──
  --    currentLevel2 = TRUE keeps it out of the level-1 approver's queue.
  ('QC-2608', 'Rule Deck Change RD-1021 via rules', 'Rule Deck Change',               'v2.0',
   'Chen Ya-ting',    'Medium', 'pending', 1, TRUE,
   'Dep. Mgr. Lin approved, routed to Design Center Assoc. Mgr. Wang',
   now() - interval '20 hours', now() - interval '2 days'),

  -- ── auto-approved by the low-risk rule, pending lead audit ──
  ('QC-2607', 'LVS Verification Report RPT-8821', 'LVS Verification Report',          'v1.0',
   'Chen Ya-ting',    'Low',    'auto',    NULL, NULL,
   'Agent pre-review passed, auto-approved by low-risk rule',
   now() - interval '1 day',    now() - interval '1 day'),

  ('QC-2603', 'LVS Verification Report RPT-8790', 'LVS Verification Report',          'v1.0',
   'Wu Meng-chun',    'Low',    'auto',    NULL, NULL,
   'Agent pre-review passed, auto-approved',
   now() - interval '7 days',   now() - interval '7 days'),

  -- ── fully approved ──
  --    routeIdx sits one past the last stage; that is how "complete" reads.
  ('QC-2606', 'Rule Deck Change RD-0981 M0 device compare', 'Rule Deck Change',       'v2.1',
   'Chen Ya-ting',    'Medium', 'approved', 2, FALSE,
   'Assoc. Mgr. Wang approved, approval complete',
   now() - interval '2 days',   now() - interval '3 days'),

  ('QC-2602', 'Rule Deck Change RD-0774 IP merge flow', 'Rule Deck Change',           'v4.0',
   'Wu Meng-chun',    'Medium', 'approved', 2, FALSE,
   'Assoc. Mgr. Wang approved, approval complete',
   now() - interval '9 days',   now() - interval '11 days'),

  -- ── rejected ──
  ('QC-2605', 'Waiver Request WV-0331', 'Waiver Request',                             'v1.0',
   'Liu Chien-hung',  'Medium', 'rejected', 0, FALSE,
   'Dep. Mgr. Lin rejected: ECO-118 still open, supply corrective-action evidence',
   now() - interval '4 days',   now() - interval '5 days'),

  ('QC-2604', 'Waiver Request WV-0312', 'Waiver Request',                             'v3.0',
   'Liu Chien-hung',  'High',   'rejected', 0, FALSE,
   'Dep. Mgr. Lin rejected: false-alarm root-cause analysis lacks evidence',
   now() - interval '6 days',   now() - interval '7 days');


-- =====================================================================
--  cases.route[] — the embedded approval stages
-- =====================================================================
--  Ordinal IS the approval order. `state` NULL means not yet decided;
--  cases."routeIdx" indexes into these rows.
INSERT INTO case_route_steps (case_id, ordinal, name, state) VALUES
  -- QC-2611: two levels, neither decided
  ('QC-2611', 0, 'Verification Dep. Mgr. Lin',        NULL),
  ('QC-2611', 1, 'Design Center Assoc. Mgr. Wang',    NULL),
  -- QC-2610: single level, undecided
  ('QC-2610', 0, 'Verification Dep. Mgr. Lin',        NULL),
  -- QC-2609: High risk -> three levels
  ('QC-2609', 0, 'Verification Dep. Mgr. Lin',        NULL),
  ('QC-2609', 1, 'Design Center Assoc. Mgr. Wang',    NULL),
  ('QC-2609', 2, 'General Manager',                   NULL),
  -- QC-2608: level 1 done, level 2 outstanding
  ('QC-2608', 0, 'Verification Dep. Mgr. Lin',        'done'),
  ('QC-2608', 1, 'Design Center Assoc. Mgr. Wang',    NULL),
  -- auto-approved documents route through the agent, not a person
  ('QC-2607', 0, 'Agent Auto-approve',                'done'),
  ('QC-2603', 0, 'Agent Auto-approve',                'done'),
  -- fully approved: every stage done
  ('QC-2606', 0, 'Verification Dep. Mgr. Lin',        'done'),
  ('QC-2606', 1, 'Design Center Assoc. Mgr. Wang',    'done'),
  ('QC-2602', 0, 'Verification Dep. Mgr. Lin',        'done'),
  ('QC-2602', 1, 'Design Center Assoc. Mgr. Wang',    'done'),
  -- rejected: the route stops at the rejecting stage
  ('QC-2605', 0, 'Verification Dep. Mgr. Lin',        'rejected'),
  ('QC-2604', 0, 'Verification Dep. Mgr. Lin',        'rejected');


-- =====================================================================
--  routing_flows — the pipelines
-- =====================================================================
--  Pipeline1..3 map to the three product types via TYPE_DEFS in the
--  frontend. Pipeline4 is operator-created and disabled, covering the
--  "rule inactive" rendering (dimmed canvas).
INSERT INTO routing_flows (name, meta, enabled) VALUES
  ('Pipeline1', 'v3 · updated 6/28 · System Admin', TRUE),
  ('Pipeline2', 'v2 · updated 5/14 · System Admin', TRUE),
  ('Pipeline3', 'v4 · updated 6/03 · System Admin', TRUE),
  ('Pipeline4', 'v1 · created today · System Admin', FALSE);


-- =====================================================================
--  routing_flows.chain[] — ordered flow nodes
-- =====================================================================
--  Node ids are POSITIONAL: 'n' || ordinal. Renaming a node is safe;
--  reordering silently rebinds the settings below. See DATA NOTE 2 in
--  mondoDBSchema.sql.
INSERT INTO routing_flow_chain (flow_name, ordinal, node_name) VALUES
  -- Pipeline1: renamed, meaningful stage names
  ('Pipeline1', 0, 'Intake'),
  ('Pipeline1', 1, 'Agent Pre-review'),
  ('Pipeline1', 2, 'Manager Review'),
  ('Pipeline1', 3, 'Sign-off'),
  -- Pipeline2: still on the default names a new pipeline starts with
  ('Pipeline2', 0, 'node1'),
  ('Pipeline2', 1, 'node2'),
  ('Pipeline2', 2, 'node3'),
  -- Pipeline3: shortest viable chain
  ('Pipeline3', 0, 'Intake'),
  ('Pipeline3', 1, 'Waiver Review'),
  -- Pipeline4: single node, disabled flow
  ('Pipeline4', 0, 'node1');


-- =====================================================================
--  routing_flows.nodeSkills{} + nodeVerify{} — per-node settings
-- =====================================================================
--  Rows are sparse on purpose: an absent node_id means "defaults" —
--  no skill bound, human verification required. Only nodes the operator
--  actually configured appear here.
INSERT INTO routing_flow_node_settings (flow_name, node_id, skill_key, human_verify) VALUES
  -- Pipeline1 fully configured: agent steps need no human confirmation,
  -- the human stages do.
  ('Pipeline1', 'n0', NULL,               FALSE),
  ('Pipeline1', 'n1', 'precheck',         FALSE),
  ('Pipeline1', 'n2', 'route',            TRUE),
  ('Pipeline1', 'n3', 'auto',             TRUE),
  -- Pipeline2 partially configured — the rest fall back to defaults
  ('Pipeline2', 'n1', 'precheck',         NULL),
  -- Pipeline3 binds the operator-created skill, proving custom skills
  -- are offered to nodes just like the built-ins
  ('Pipeline3', 'n1', 'duplicate-check',  TRUE);
  -- Pipeline4: no rows at all -> everything defaulted


-- =====================================================================
--  routing_flows.mid[] + high[] — legacy per-risk approver chains
-- =====================================================================
--  Nothing in the current UI reads these; they are still round-tripped by
--  the API. Kept so the fixture matches a real document.
--  Codes: v = Verification Dep. Mgr., d = Design Center Assoc. Mgr.,
--         g = General Manager, q = QA Dept. Mgr.
INSERT INTO routing_flow_approver_chain (flow_name, branch, ordinal, approver_key) VALUES
  ('Pipeline1', 'mid',  0, 'v'), ('Pipeline1', 'mid',  1, 'd'),
  ('Pipeline1', 'high', 0, 'v'), ('Pipeline1', 'high', 1, 'd'), ('Pipeline1', 'high', 2, 'g'),
  ('Pipeline2', 'mid',  0, 'v'),
  ('Pipeline2', 'high', 0, 'v'), ('Pipeline2', 'high', 1, 'd'),
  ('Pipeline3', 'mid',  0, 'v'),
  ('Pipeline3', 'high', 0, 'v'), ('Pipeline3', 'high', 1, 'q'),
  ('Pipeline4', 'mid',  0, 'v'),
  ('Pipeline4', 'high', 0, 'v'), ('Pipeline4', 'high', 1, 'd');


-- =====================================================================
--  activity — the agent feed
-- =====================================================================
--  Append-only, read newest-first. `at` is the sort key and the source of
--  the 'HH:MM' the API renders; no clock string is stored.
--  chip is a colour ROLE: accent = in progress, green = completed,
--  amber = needs attention.
INSERT INTO activity (icon, chip, text, sub, at) VALUES
  ('IN', 'accent', 'New request QC-2611 · Rule Deck Change RD-1042',
   'Chen Ya-ting · uploaded to DMS',                          now() - interval '2 hours'),
  ('PR', 'accent', 'Pre-review passed for QC-2611',
   'format ✓ attachments 3/3 ✓ no open ECO',                  now() - interval '2 hours' + interval '40 seconds'),
  ('GR', 'amber',  'Risk grade for QC-2611: Medium',
   'Route → 2 levels of manual approval',                     now() - interval '2 hours' + interval '55 seconds'),
  ('AL', 'amber',  'QC-2610 has a linked ECO still in progress',
   'ECO-204 · corrective action not closed',                   now() - interval '6 hours'),
  ('GR', 'amber',  'Risk grade for QC-2609: High',
   'Route → 3 levels of manual approval',                      now() - interval '1 day' - interval '3 hours'),
  ('AP', 'accent', 'QC-2608 approved by Dep. Mgr. Lin',
   'Routed to Design Center Assoc. Mgr. Wang',                 now() - interval '20 hours'),
  ('OK', 'green',  'QC-2607 auto-approved, queued for approval-lead audit',
   'Sampling rate 20%',                                       now() - interval '1 day'),
  ('OK', 'green',  'QC-2606 approved by Assoc. Mgr. Wang',
   'Approval complete',                                       now() - interval '2 days'),
  ('RJ', 'amber',  'QC-2605 rejected by Dep. Mgr. Lin',
   'ECO-118 still open',                                      now() - interval '4 days'),
  ('RJ', 'amber',  'QC-2604 rejected by Dep. Mgr. Lin',
   'False-alarm root-cause analysis lacks evidence',           now() - interval '6 days');

COMMIT;


-- =====================================================================
--  SANITY CHECKS
-- =====================================================================
--  Run these after loading; each should return no rows.

--  1. routeIdx must point at an existing stage, or one past the last for a
--     completed approval.
-- SELECT c.id, c."routeIdx", count(s.*) AS stages
--   FROM cases c LEFT JOIN case_route_steps s ON s.case_id = c.id
--  WHERE c."routeIdx" IS NOT NULL
--  GROUP BY c.id, c."routeIdx"
-- HAVING c."routeIdx" > count(s.*);

--  2. A pending document must have an undecided stage at routeIdx.
-- SELECT c.id FROM cases c
--   JOIN case_route_steps s ON s.case_id = c.id AND s.ordinal = c."routeIdx"
--  WHERE c.status = 'pending' AND s.state IS NOT NULL;

--  3. Node settings must reference a node the chain actually has.
-- SELECT s.flow_name, s.node_id FROM routing_flow_node_settings s
--  WHERE NOT EXISTS (
--    SELECT 1 FROM routing_flow_chain c
--     WHERE c.flow_name = s.flow_name AND 'n' || c.ordinal = s.node_id);

--  4. Expected shape of the Pending Items queue — documents awaiting a
--     level-1 decision. Should be QC-2611, QC-2610, QC-2609.
-- SELECT id, risk, "submittedAt" FROM cases
--  WHERE status = 'pending' AND "routeIdx" = 0 AND "currentLevel2" IS NOT TRUE
--  ORDER BY "submittedAt" DESC;
-- =====================================================================
