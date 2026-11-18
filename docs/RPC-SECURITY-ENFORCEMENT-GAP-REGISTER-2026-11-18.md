# RPC Security Enforcement Gap Register — INTAL

Date: 2026-11-18
Baseline: PR #253 head `037a279cef7514523595d3cf0bbcd1a23c60a9e6`
Status: forensic static review; not runtime certification.

## Executive decision

PR #253 adds a useful RPC candidate manifest and CI contract, but it does not yet implement a runtime RPC gateway or prove complete authorization across the callable surface. Keep the PR draft and do not merge it as a completed RPC security control. This document records the remaining release blockers without changing application runtime, deployment settings, Script Properties, spreadsheet ACLs, or canonical datasets.

## Confirmed evidence and gaps

### P0 — Manifest is not runtime enforcement

Evidence:
- `gas/RpcManifest.js` exports `RPC_MANIFEST_V1` and `getRpcManifestEntryV1(name)`.
- The manifest header explicitly describes itself as inventory and says it does not replace endpoint guards or add Gateway authentication.
- The reviewed `gas/Auth.gs` does not consult `getRpcManifestEntryV1` from `requirePermission_`, `requireBackOfficeAccess_`, or `getCurrentUser_`.

Impact:
- The manifest is currently metadata plus CI drift checking. It does not centrally deny an unlisted name at runtime and does not itself enforce the declared permission.

Required remediation:
1. Introduce a server-side policy enforcement function only after defining a safe migration contract.
2. Ensure every protected public RPC invokes the enforcement boundary itself or through a verified, explicit wrapper.
3. Keep the anonymous Public TV allowlist separate; never grant a general anonymous fallback.
4. Add runtime tests proving an unknown RPC is denied and each protected endpoint checks the exact declared capability.

### P0 — CI guard check is shallow and can miss indirect paths

Evidence:
- The guard contract in `gas/test-shim.js` extracts an endpoint body and checks a direct permission call or a single called helper.
- The delegated check searches helper source for the expected permission string, but does not recursively resolve a complete call graph, control-flow conditions, aliases, dynamic dispatch, or helper-to-helper chains.
- The source segment helper uses the next top-level function declaration as a boundary rather than a syntax-aware parser.

Impact:
- A passing test is not proof that all reachable paths are protected. It can miss a multi-hop path or misread function boundaries and conditional authorization.

Required remediation:
1. Use a syntax-aware parser compatible with the repository's Apps Script JavaScript syntax, or implement a deliberately constrained parser with explicit unsupported-syntax failures.
2. Build a call graph for every callable declaration, including cross-file helpers.
3. Trace every reachable data read/write and authorization helper.
4. Fail CI on unresolved dynamic dispatch, ambiguous function resolution, unsupported syntax, or unclassified reachable side-effect helpers.
5. Add adversarial fixtures: direct guard, one-hop guard, multi-hop guard, wrong permission, guard in a conditional branch, early return before guard, dynamic call, and unguarded mutating helper.

### P1 — Public TV classification is not publication certification

Evidence:
- Eleven anonymous Public TV RPCs are classified in the manifest.
- Existing public-TV review describes itself as static source review, not live HTTP capture or legal/privacy approval.
- The current CI assertion for `public_read_only` checks absence of `requirePermission_`; it does not prove no writes, bounded data, exact response keys, or publication approval.

Required remediation:
1. Keep the finite anonymous allowlist.
2. Add exact response-key/schema tests per endpoint.
3. Add negative tests for writes and raw-row/identity/permission leakage.
4. Verify filter bounds, response size, coordinate verification status, and running-text moderation.
5. Record data-owner approval for each publicly disclosed aggregate and operational field before certification.

### P1 — Self-scope endpoints need explicit contract tests

Evidence:
- `hasPermission` and `getMyPermissions` are classified as `self_scope`.
- Current CI checks only for a call to `getCurrentUser_`.

Required remediation:
1. Verify these methods cannot accept another user's identity or role as an argument.
2. Assert output contains only the caller's own permission information.
3. Test anonymous, disabled, duplicate-identity, and revoked-permission cases.

### P1 — Stateless validation endpoint needs a data-flow review

Evidence:
- `validateDailyInputPayloadV1` is classified as `stateless_validation` with no permission.
- The current manifest contract permits non-protected classes to have null permission, but does not prove the function is pure or independent of protected storage.

Required remediation:
1. Verify no Spreadsheet, Drive, Properties, Cache, network, or mutation side effects are reachable.
2. Bound input size, nesting, arrays, strings, and computational complexity.
3. Test that validation returns no user, dataset, or internal configuration data.

### P0 — Workspace identity remains staged, not proven in deployment

Evidence:
- `gas/Auth.gs` obtains the identity from `Session.getActiveUser().getEmail()`.
- The enforcement feature flag is read from Script Properties and is intentionally OFF by default.
- PR #253 explicitly requires an isolated `USER_ACCESSING` Workspace-domain deployment and separate spreadsheet before activation.

Required remediation:
1. Preserve enforcement OFF on the active production deployment.
2. Verify actual deployment execution identity and access mode in an isolated deployment.
3. Test multiple Workspace accounts, external accounts, missing identity, revoked access, and Spreadsheet/Drive permission boundaries.
4. Record deployment ID, manifest settings, account matrix, resource ACL evidence, and rollback proof.

## Required test matrix

| Surface | Anonymous | Authenticated wrong role | Revoked/disabled | Authorized |
|---|---|---|---|---|
| Protected read RPC | Deny | Deny | Deny | Allow exact capability |
| Protected mutation RPC | Deny/no write | Deny/no write | Deny/no write | Allow with audit + idempotency |
| Public TV RPC | Allow approved projection only | Same projection | Same projection | Same projection |
| Self-scope RPC | Minimal unauthenticated response or deny | Own data only | Deny/minimal | Own data only |
| Stateless validator | Bounded pure validation only | Same | Same | Same |

## Release gates

- [ ] Syntax-aware callable inventory and complete call graph pass.
- [ ] Every protected endpoint has a proven exact server-side permission check.
- [ ] Every public endpoint has exact output schema and no-write tests.
- [ ] Setup/bootstrap functions are inaccessible through browser RPC and editor-only paths are documented.
- [ ] Import, backup, period closing, office reference, and all other mutating RPCs pass negative tests.
- [ ] Workspace identity and resource access are verified in isolated `USER_ACCESSING` deployment.
- [ ] Rollback evidence exists before any production migration.

## Non-impact boundary

This gap register is documentation only. It does not activate Workspace identity enforcement, change the active Apps Script deployment, modify Script Properties or Drive/Spreadsheet ACLs, enable Daily Input, change Gate 9.1, or mutate canonical monthly Residence Permit / Passport datasets.


## Follow-up implementation — constrained call-graph inventory

Branch `security/rpc-callgraph-audit-v1-2026-11-18` adds `gas/rpc-audit.js` and fixture coverage in `gas/test-shim.js`.

The analyzer:
- tokenizes source while skipping line/block comments and quoted strings;
- extracts classic named function declarations using balanced parameter/body delimiters;
- records statically named calls and computes transitive reachability across supplied source files;
- reports duplicate global function names, malformed declarations/bodies, and template interpolation as unsupported;
- preserves reachable helper bodies so a reviewer/test can compare the actual permission literal against the manifest.

**Important limitation:** this is a constrained inventory tool, not a complete ECMAScript parser, control-flow analyzer, or authorization proof. It does not prove that a guard dominates every path, resolve dynamic dispatch/aliases, or establish side-effect/data-flow safety. It must not be used as a reason to enable a global RPC gateway or to certify an endpoint. Unsupported/ambiguous results remain blockers and require syntax-aware tooling or manual review.

Fixture tests cover multi-hop helper reachability, visibility of a wrong permission literal, template interpolation fail-closed reporting, duplicate declarations, and unbalanced bodies. The repository test harness also builds a cross-file graph for the manifest and checks that each protected endpoint has a reachable exact permission guard; public-read-only and self-scope classifications receive corresponding reachable-call checks. This remains a static, name-based check and is not proof of guard dominance or side-effect purity.

GitHub Actions `RPC Security Contract` run #65 completed SUCCESS for head `3215acfc459340315a46aa9f0062ffc35a184c3e`. Earlier iterations failed on fixture and regular-expression assertions; those failures were corrected before run #65. This CI result applies to the tested commit only.


### Analyzer hardening note

The follow-up lexer now treats recognized regular-expression literals as opaque tokens so source text such as `/function fake(){}/` cannot be mistaken for a function declaration. It also reports computed calls such as `target[method]()` and dynamic code execution through `eval` / `Function` as unsupported blockers. Regression fixtures cover these cases.

The regular-expression start heuristic is intentionally conservative but is not a standards-complete JavaScript lexer. This tool remains an inventory aid; it does not establish control-flow dominance, alias resolution, or complete Apps Script semantics. CI execution is still required to validate the changes.


### Transitive side-effect inventory

The analyzer now classifies selected mutation calls and external-I/O calls across every statically reachable helper. The CI contract uses this inventory to reject public-read-only RPCs that transitively reach known mutation or external-I/O calls, and to reject stateless validators with those effects. Fixtures cover a safe read-only path, a hidden helper mutation (`appendRow`), and a pure validation path.

This remains a bounded sink list, not a complete side-effect/data-flow proof. Dynamic aliases, indirect APIs, unrecognized mutator methods, Apps Script services not in the list, and unsupported syntax can evade this inventory. Public TV certification still requires response-schema review, sensitive-field checks, and runtime verification.


### Dynamic syntax blockers in exposed read-only paths

The transitive effect collector now emits explicit blockers for computed member invocation (for example, `target[method]()`), dynamic code execution through `eval` / `Function`, template interpolation, and malformed function syntax. Public-read-only and stateless-validation CI contracts reject these blockers in their reachable helper paths. A regression fixture initially exposed that the effect collector did not carry the computed-call finding from the function extractor; the collector was corrected to detect the pattern directly in each reachable function body, and the next CI run passed.

This reduces known blind spots but does not prove complete absence of side effects. The sink inventory and lexical parser remain intentionally bounded.


### Public TV projection regression coverage

The CI harness now executes the public dashboard and map sanitizers against deliberately contaminated fixtures containing identity, permission, user, and raw-row fields. It asserts exact top-level and nested response keys. It also exercises the running-text data path with active and inactive rows and verifies that the anonymous endpoint returns only active content strings, not content IDs or creator metadata.

Coverage is intentionally partial: the current executable projection tests cover dashboard, map, and running-text responses. Analytical running text, Passport YoY responses, office-level YoY, service-point references, and M-Paspor quota still require their own exact response-schema and data-publication review before Public TV can be production-certified.


Additional Public TV contract coverage now executes the analytical running-text adapter against a controlled reporting fixture and enforces an allowlist of narrative fields. The service-point reference endpoint is also exercised and its point records are constrained to the declared public reference fields, including explicit coordinate/reference status.

The remaining public response contracts still needing dedicated executable fixtures are Passport YoY, office-level Passport YoY, Passport service YoY, and M-Paspor quota. Their publication approval and live response verification remain separate release gates.


### Completion of Public TV Passport and M-Paspor response fixtures

The test harness now executes the four previously outstanding public response adapters using controlled fixtures:
- Passport Year-over-Year: exact top-level contract and monthly/office row allowlists.
- Passport office Year-over-Year: required office filter rejection, exact response contract, and monthly row allowlist.
- Passport service Year-over-Year: exact response contract and preservation of the `NOT_COMPARABLE` taxonomy decision.
- M-Paspor quota: exercises the actual quota snapshot office list with a matching verified-reference fixture, then checks office and GIS marker field allowlists and excludes verification timestamps / unapproved fields.

The latest passing CI run is RPC Security Contract #85 (run ID `44244245984`) on commit `475da2768ffe6854c15f26f4b9d2d783122b79b6`. This is automated fixture evidence only; it does not approve public publication of every reference field or replace a live deployment/UAT review.

### Self-scope caller isolation regression

The harness also exercises `hasPermission` and `getMyPermissions` with separate active-user identities against the same controlled USERS/PERMISSIONS fixtures. It verifies that the administrator receives only the administrator's permission set, the viewer does not inherit administrator permissions, and an unknown active email is unauthenticated. This tests caller identity binding in the current runtime path; it does not replace Workspace `USER_ACCESSING` deployment verification.


### Protected RPC runtime denial-before-side-effect fixture

A runtime fixture now invokes the protected `adminCreateUser` RPC under both VIEWER and ADMIN identities. The VIEWER request must fail with `FORBIDDEN: admin.users` before UUID generation or persistent writes; the ADMIN request is permitted and produces the expected single user-row write. This is a focused negative/positive endpoint test, not yet an exhaustive runtime test of every protected manifest RPC.

The fixture passed in RPC Security Contract #87 (run ID `44244365008`), tested commit `d7df431505e4b8777a475ecf7f2598a352064f50`.

### Daily Input provisioning denial-before-side-effect fixture

The protected RPC fixture now also invokes the real `provisionDailyInputStorageV1()` implementation with a VIEWER identity and controlled Apps Script service doubles. The caller has `daily.read` but not `admin.config`. The fixture asserts the exact `FORBIDDEN: admin.config` denial and verifies that denial occurs before script-lock acquisition, Spreadsheet access, sheet writes, or Script Properties mutation.

GitHub Actions `RPC Security Contract` run #91 (run ID `44245421444`) completed SUCCESS for PR #262 head `9dce820577d69750847ae455540ce0d4d6b2c62e`; the full repository `npm test` command passed. Run #90 had failed because the fixture source concatenation contained an over-escaped newline; this was corrected in the subsequent commit before run #91.

This is a controlled fixture-level authorization test. It does not certify deployed Apps Script behavior, Workspace identity enforcement, real Drive/Spreadsheet ACLs, or the complete Daily Input lifecycle. Gate 9.1 remains BLOCKED and Daily Input remains disabled.

### Import and period-mutation denial-before-lock fixtures

The protected RPC negative matrix now includes three additional entrypoints:
- `commitImport()`: a caller without `dataset.import` must receive the exact `FORBIDDEN: dataset.import` denial before parsing input or requesting the script lock.
- `closePeriod()`: a caller without `admin.config` must be denied before requesting the script lock.
- `reopenPeriod()`: a caller without `admin.config` must be denied before requesting the script lock.

The tests invoke the actual service function declarations in controlled V8 fixtures and count lock requests. RPC Security Contract run #96 (run ID `44245796901`) completed SUCCESS with `npm test` on code head `1f5e69157059afbc87877b5e24416981c441cb76`.

These fixtures prove only the tested unauthorized-denial ordering. They do not yet test authorized import/period mutation success, downstream transactional behavior, all import variants, or deployed Apps Script runtime behavior. The protected RPC matrix remains incomplete.

### Extended protected RPC denial-before-side-effect fixtures

The controlled runtime fixture matrix now includes five additional checks:
- `commitGoogleSourceImport()`: missing `dataset.import` must deny before Google-source adaptation/read, canonical import commit, or audit append.
- `repairPassportServiceMonthly2025DerivedTotal()`: missing `dataset.write` must deny before script-lock acquisition.
- `saveRunningText()` and `deleteRunningText()`: missing `admin.config` must deny before running-text sheet access or audit append.
- `setBackupFolder()`: missing `admin.config` must deny before folder-ID normalization, Drive lookup, or Script Properties mutation.

GitHub Actions `RPC Security Contract` run #98 (run ID `44246418632`) completed SUCCESS for code head `14cfed826f17b040147a0aae2632becbb91b83d8`; the full `npm test` command passed.

These are unauthorized-path fixture results only. Authorized mutation success, persistence semantics, idempotency, rollback behavior, real Apps Script service permissions, and full backup/restore safety remain unverified. The backup/recovery center's read-only policy is not a substitute for testing each backup or recovery mutation endpoint.

### Backup snapshot creation denial-before-read fixtures

The runtime fixture matrix now invokes the three snapshot-creation RPCs with an unauthorized caller:
- `createResidencePermitSnapshot()`
- `createPassportServiceSnapshot()`
- `createPassportServiceMonthly2025Snapshot()`

Each must deny with `FORBIDDEN: admin.config` before reading backup configuration or canonical dataset state. RPC Security Contract run #100 (run ID `44246560867`) completed SUCCESS; `npm test` passed on code head `18115175e871a85a09b0e23a9acd54cf2a2dd702`.

This confirms denial ordering for the tested unauthorized path only. It does not test authorized snapshot creation, snapshot integrity, retention, restore execution, or real Drive/Spreadsheet ACL behavior.

