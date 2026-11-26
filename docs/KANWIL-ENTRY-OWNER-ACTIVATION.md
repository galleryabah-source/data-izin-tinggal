# Kanwil Entry — Owner Activation Runbook

## Purpose

This runbook provisions the dedicated Kanwil staging spreadsheet without touching the canonical Residence/Passport store. It is an operator procedure, not proof that production storage has already been provisioned.

## Required owner preparation

Use the dedicated spreadsheet supplied by the project owner. Do not place its ID in source code, Git commits, logs, screenshots, or public issue comments.

In the Apps Script project that serves INTAL WEB APP, open **Project Settings → Script Properties** and configure:

| Property | Value |
|---|---|
| `KANWIL_STAGING_SPREADSHEET_ID` | The exact ID of the owner-provided Kanwil spreadsheet |
| `KANWIL_SCOPE_ID` | The stable scope identifier approved for this Kanwil deployment |
| `KANWIL_STAGING_ENABLED` | Keep unset or `false` during provisioning and UAT |

Do not change `SPREADSHEET_ID`. The staging guard rejects a target that is identical to the canonical spreadsheet.

The account executing provisioning must be an authorized back-office administrator and have Editor access to the dedicated spreadsheet. The six staging sheets are not a replacement for Drive/Spreadsheet ACLs; keep sharing restricted to approved operators.

## Provisioning

1. Confirm the Apps Script project is the reviewed release containing `KanwilStagingService.gs` and the protected RPC manifest entry.
2. Confirm the three properties above are configured, with the feature flag still OFF.
3. In the Apps Script editor, select and run `provisionKanwilStagingFromConfiguredId` as the authorized owner.
4. Complete any Google authorization prompt using the intended owner account.
5. Confirm the execution returns `ready: true` and `enabled: false`.
6. Run the protected `verifyKanwilStorageTargetsV1` preflight. It verifies the configured spreadsheet schema and actual Drive write permission using a temporary file that is immediately trashed. It deliberately keeps `KANWIL_STAGING_ENABLED=false`.
7. Confirm these six tabs exist and their first-row headers exactly match the schema constants:
   - `KANWIL_BATCHES`
   - `KANWIL_FILES`
   - `KANWIL_STAGING`
   - `KANWIL_RECORDS`
   - `KANWIL_EVENTS`
   - `KANWIL_AUDIT`

The provisioning routine first preflights every existing non-empty tab, including exact header count and order, before creating or modifying any tab. If any existing tab is mismatched, provisioning stops before creating missing tabs. It then creates missing tabs and writes headers only into empty tabs; it never overwrites a non-empty tab. The staging spreadsheet ID is persisted only after all six tabs validate.

## Runtime UAT — feature flag remains OFF

After schema provisioning, validate access and readiness using the protected status RPC. Then execute the test matrix in a controlled non-production data window with at least two authorized back-office users:

- Manual intake: required fields, text preservation for application/passport identifiers, date validation.
- Retry: same submission ID and same payload returns the same staging record; changed payload is rejected.
- Scope isolation: replay from a different configured scope must fail closed.
- File intake: CSV/XLSX parsed rows, checksum/parser/scope/channel idempotency, duplicate source rows, duplicate application numbers, row-limit and file-size limits.
- Validation queue: malformed rows are visible with validation errors and cannot be approved.
- Separation of duties: creator cannot approve/reject their own row.
- Review: approve and reject require a reason and leave event/audit evidence.
- Finalization: only APPROVED records can be committed; duplicate application numbers are rejected; finalization is bound to the original persisted batch scope.
- Recovery: simulate a partial multi-sheet failure in a test spreadsheet and verify rollback/reconciliation behavior.
- Isolation: verify canonical Residence/Passport datasets, registry, importer, Daily Input, and historical baselines have no writes or row-count changes.

## Activation gate

Only after all UAT evidence is reviewed and approved:

1. Set `KANWIL_STAGING_ENABLED=true`.
2. Re-check the protected status RPC returns `enabled: true`, `configured: true`, and `writeMode: ISOLATED_KANWIL_STAGING`.
3. Run a minimal authorized canary intake and independent review in the approved scope.
4. Verify the six staging tabs, audit/event linkage, and canonical non-interference.
5. Record deployment, UAT, and production-certification statuses separately.

A green GitHub Actions run proves repository tests only. It does not prove spreadsheet access, schema provisioning, Workspace identity, runtime UAT, deployment, or production certification.
