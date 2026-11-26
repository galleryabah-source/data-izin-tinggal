# Kanwil Entry — Isolated Staging Runtime

**Implementation state:** code path implemented on PR #269; runtime remains disabled until a dedicated storage target and Workspace UAT are verified.

## Scope

The Kanwil workspace is an application-intake workflow based on the existing 17-column source contract. It is separate from the Phase 9 Daily Input workflow.

- Manual entry sends the 17 whitelisted fields to authenticated Apps Script RPC.
- CSV/XLSX and browser OCR results can be explicitly saved as structured rows after local parsing and operator review.
- Original file bytes are not uploaded. Only file metadata, SHA-256, parser output, source row number, and validation evidence are stored.
- Each imported row enters `REVIEW_REQUIRED` or `VALIDATION_REQUIRED`; the lifecycle `state` is persisted independently from `review_state` so queue, review, and finalization do not infer state from an unrelated column.
- Import rows are normalized again on the server; impossible calendar dates, duplicate physical source-row numbers, and duplicate application numbers are rejected or routed to validation.
- A different back-office user must approve/reject the row.
- Finalization writes to `KANWIL_RECORDS` in the dedicated Kanwil spreadsheet only.
- No Residence/Passport monthly dataset, registry, importer, Daily Input, or historical baseline is modified.

## Storage isolation

Required Script Properties:

| Property | Purpose |
|---|---|
| `SPREADSHEET_ID` | Existing canonical application store; read only by Kanwil staging guard to compare identities |
| `KANWIL_STAGING_SPREADSHEET_ID` | Dedicated Kanwil staging spreadsheet; must differ from `SPREADSHEET_ID` |
| `KANWIL_SCOPE_ID` | Stable region/office scope key used in import idempotency and record identity |
| `KANWIL_STAGING_ENABLED` | Explicit feature switch; must remain unset/false until runtime UAT is approved |

The staging spreadsheet must contain eight sheets with exact headers provisioned by `provisionKanwilStagingSchema_()`:

- `KANWIL_BATCHES`
- `KANWIL_FILES`
- `KANWIL_STAGING` (includes explicit `review_state`, `state`, and `revision` columns)
- `KANWIL_RECORDS`
- `KANWIL_EVENTS`
- `KANWIL_REVISIONS`
- `KANWIL_RECONCILIATIONS`
- `KANWIL_AUDIT`

Provisioning validates all six header rows before persisting the staging spreadsheet ID. It does not set the feature flag. Never point the Kanwil staging property at the canonical spreadsheet.

## RPC boundary

All callable Kanwil RPC endpoints are classified as protected with `backoffice.access` in `RpcManifest.js` and independently call `requireBackOfficeAccess_()`:

- `getKanwilEntryStatus`
- `saveKanwilApplication`
- `saveKanwilImportBatch`
- `listKanwilApplications`
- `reviewKanwilApplication`
- `commitKanwilApplication`

The owner provisioning entrypoint `provisionKanwilStagingFromConfiguredId` is protected by `backoffice.access` plus `admin.config`. Internal validation, hashing, checkpoint, and rollback helpers end with an underscore and are not exposed as RPC.

## Operational sequence

1. Create a dedicated Kanwil staging spreadsheet with restricted access.
2. Verify the spreadsheet is not the canonical `SPREADSHEET_ID`.
3. Configure the staging spreadsheet ID in Script Properties, then run the guarded `provisionKanwilStagingFromConfiguredId` owner entrypoint from the authorized Apps Script project context. See [KANWIL-ENTRY-OWNER-ACTIVATION.md](./KANWIL-ENTRY-OWNER-ACTIVATION.md).
4. Run `verifyKanwilStorageTargetsV1` to prove schema readiness and Drive write access. This preflight does not enable writes.
5. Set a stable `KANWIL_SCOPE_ID`.
6. Run the runtime matrix with at least two authorized back-office users: manual create, file import, retry/idempotency, duplicate application number, invalid dates, validation-required rows, independent review, rejection, approval, finalization, and audit reconciliation.
7. Confirm no write or row-count delta occurs in canonical monthly datasets, registry, importer, or Daily Input.
8. Only after the runtime UAT and least-privilege review are signed off, set `KANWIL_STAGING_ENABLED=true`.
9. Run production smoke and retain evidence before declaring the feature deployed or production-certified.

## Important limitations

- This PR does not set production Script Properties, create a Drive spreadsheet, modify Drive ACLs, or deploy Apps Script.
- Screenshot/OCR values remain machine-extracted candidates and require human review. Each file import request is limited to 500 parsed rows and each source file is limited to 20 MB; larger source files must be split before intake.
- Original file bytes remain in the user's browser; only extracted structured fields and client-calculated file checksum/metadata are sent to staging. Because bytes are not uploaded, the checksum is an idempotency hint, not server-side proof that the source file bytes match the claimed digest.
- User-controlled file metadata and audit reasons are neutralized before being written into spreadsheet cells to prevent formula injection.
- Google Sheets does not provide cross-sheet ACID transactions. Writes use Script Lock, checkpoints, rollback attempts, idempotency keys, and audit events; consistency verification is still required after partial failures.
- The feature flag remains OFF by default. A green CI result is not runtime UAT or production certification.
