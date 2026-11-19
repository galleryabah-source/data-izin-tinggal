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
