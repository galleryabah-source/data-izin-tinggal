# Kanwil Entry — Isolated Staging Runtime

**Implementation state:** code path implemented on PR #269; runtime remains disabled until a dedicated storage target and Workspace UAT are verified.

## Scope

The Kanwil workspace is an application-intake workflow based on the existing 17-column source contract. It is separate from the Phase 9 Daily Input workflow.

- Manual entry sends the 17 whitelisted fields to authenticated Apps Script RPC.
- CSV/XLSX and browser OCR results can be explicitly saved as structured rows after local parsing and operator review.
- Original file bytes are not uploaded. Only file metadata, SHA-256, parser output, source row number, and validation evidence are stored.
- Each imported row enters `REVIEW_REQUIRED` or `VALIDATION_REQUIRED`.
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

The staging spreadsheet must contain six sheets with exact headers provisioned by `provisionKanwilStagingSchema_()`:

- `KANWIL_BATCHES`
- `KANWIL_FILES`
- `KANWIL_STAGING`
- `KANWIL_RECORDS`
- `KANWIL_EVENTS`
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

Private provisioning, validation, hashing, checkpoint, and rollback helpers end with an underscore and are not exposed as RPC.

## Operational sequence

1. Create a dedicated Kanwil staging spreadsheet with restricted access.
2. Verify the spreadsheet is not the canonical `SPREADSHEET_ID`.
3. Run `provisionKanwilStagingSchema_('<staging-id>')` from the authorized Apps Script project context.
4. Set a stable `KANWIL_SCOPE_ID`.
5. Run the runtime matrix with at least two authorized back-office users: manual create, file import, retry/idempotency, duplicate application number, invalid dates, validation-required rows, independent review, rejection, approval, finalization, and audit reconciliation.
6. Confirm no write or row-count delta occurs in canonical monthly datasets, registry, importer, or Daily Input.
7. Only after the runtime UAT and least-privilege review are signed off, set `KANWIL_STAGING_ENABLED=true`.
8. Run production smoke and retain evidence before declaring the feature deployed or production-certified.

## Important limitations

- This PR does not set production Script Properties, create a Drive spreadsheet, modify Drive ACLs, or deploy Apps Script.
- Screenshot/OCR values remain machine-extracted candidates and require human review.
- Original file bytes remain in the user's browser; only the extracted structured fields and file checksum/metadata are sent to staging.
- Google Sheets does not provide cross-sheet ACID transactions. Writes use Script Lock, checkpoints, rollback attempts, idempotency keys, and audit events; consistency verification is still required after partial failures.
- The feature flag remains OFF by default. A green CI result is not runtime UAT or production certification.
