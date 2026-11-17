# Kanwil Residence Permit — Data Contract v1

**Status:** Design contract; not deployed or production-certified.  
**Decision:** Dedicated Kanwil operational module, linked to INTAL reporting through a read-only adapter.  
**Sources:** Excel/CSV and screenshot/camera photo.  
**Timezone:** Asia/Jakarta.  
**Data boundary:** This contract is isolated from the canonical monthly Residence and Passport datasets.

## 1. Scope and invariants

This module records individual residence-permit applications processed for issuance by the Regional Office (Kanwil). It is not the daily Kanim service-input workflow and is not a replacement for either monthly canonical dataset.

Non-negotiable invariants:

1. No writes, schema changes, imports, or backfills to `RESIDENCE_PERMIT_SERVICE_MONTHLY` or `PASSPORT_SERVICE_MONTHLY`.
2. No use of the canonical monthly `previewImport()` / `commitImport()` pipeline for individual application records.
3. Input from either source enters isolated staging. No OCR auto-commit and no silent correction.
4. Reporting integration is read-only and exposes approved aggregates only; no PII in shared reporting.
5. Every source file, import batch, row revision, review decision, commit, and export is auditable.
6. The 17 source columns shown in the supplied Kanwil table are the v1 observed contract. Do not invent the two fields present in the separate 19-column screenshot-entry proposal.
7. The source screenshot does not show a per-row immigration-office field. Kanwil/source scope is batch metadata, not a fabricated row value.
8. A value not present in the source remains null; never infer it from adjacent rows or external context.

## 2. Source columns — observed v1

The screenshot shows 17 columns. The canonical keys below preserve source semantics and order.

| # | Source header | Canonical key | Type | Rule |
|---:|---|---|---|---|
| 1 | Tanggal Pembayaran | `tanggal_pembayaran` | timestamp | Preserve source text and parsed timestamp; timezone must be confirmed from export settings |
| 2 | Tanggal Mulai Verifikasi | `tanggal_mulai_verifikasi` | timestamp | Nullable if blank |
| 3 | Tanggal Auto Terbit | `tanggal_auto_terbit` | timestamp | Nullable if blank |
| 4 | Layanan | `layanan` | text/code | Preserve raw token; normalized lookup is versioned |
| 5 | Kategori Produk | `kategori_produk` | text/code | Preserve raw token |
| 6 | Nomor Permohonan | `nomor_permohonan` | string | Required; never numeric-cast or strip leading zeroes |
| 7 | Tanggal Permohonan | `tanggal_permohonan` | timestamp | Preserve source value; parse only when unambiguous |
| 8 | Penjamin | `penjamin` | text | PII/business identity; preserve spelling |
| 9 | Nama | `nama` | text | PII; preserve spelling |
| 10 | Jenis Kelamin | `jenis_kelamin` | text/code | Preserve source token |
| 11 | Tanggal Lahir | `tanggal_lahir` | date | Strict parsing; ambiguous dates go to review |
| 12 | Kebangsaan | `kebangsaan` | text/code | Preserve source token |
| 13 | No. Passport | `no_passport` | string | PII; never numeric-cast or alter characters |
| 14 | Jenis Produk | `jenis_produk` | text/code | Preserve source token |
| 15 | Tujuan | `tujuan` | text/code | Preserve source token |
| 16 | Posisi Permohonan | `posisi_permohonan` | text | Preserve source token |
| 17 | Status Permohonan | `status_permohonan` | text/code | Preserve source token |

### 2.1 Batch-level provenance

The following are metadata, not source columns:

- `source_channel`: `EXCEL`, `CSV`, `SCREENSHOT`, or `CAMERA_PHOTO`
- `source_filename`, `source_file_sha256`, `source_file_mime`, `source_file_size`
- `kanwil_scope_id` / approved Kanwil reference
- `source_exported_at` (if provided by source)
- `imported_by`, `imported_at`, `contract_version`, `parser_version`
- source authorization/provenance reference and retention classification

Do not infer an office from the operator's account or current location. Bind the batch to a Kanwil scope only from an explicit authorized selection or trusted source metadata.

## 3. Canonical record envelope

Each staged row contains:

- `record_id`: server-generated UUID
- `batch_id`, `file_id`, `source_row_number`
- `contract_version`: `KANWIL_PERMIT_APPLICATION_V1`
- `raw_values`: exact cell/OCR strings
- `normalized_values`: deterministic normalized values; identifiers/names remain unchanged
- `field_evidence`: source cell coordinates (for image), source column/header, parser confidence if available
- `validation_errors[]`, `validation_warnings[]`
- `duplicate_state`, `review_state`, `commit_state`
- `revision`, `created_at`, `updated_at`

The original file remains immutable in a private restricted Drive location. A screenshot crop or OCR text is derived evidence and must never replace the original.

## 4. Ingestion contract

### Excel / CSV

- Detect file type from content and supported parser, not extension alone.
- Require one unambiguous header row; map exact headers and approved aliases.
- Preserve source row number and original cell text.
- Preserve identifiers as strings, including leading zeroes.
- Reject ambiguous date parsing; do not silently reinterpret locale formats.
- Ignore no unknown columns silently: report them as unmapped metadata for review.
- Reject duplicate header names and ambiguous alias collisions.

### Screenshot / camera photo

- Browser-local OCR only in the initial cost-constrained design; no paid OCR API or cloud fallback.
- Header mapping must resolve all 17 columns one-to-one before row extraction.
- Keep OCR raw text, word/cell confidence, bounding boxes, and source image reference.
- Incomplete, horizontally cropped, rotated/skewed beyond validated bounds, wrapped/merged, or ambiguous tables go to manual review.
- OCR output is never a committed record without human review.

### Shared limits

Initial limits are pilot configuration only: 200 files/batch, 5 MB/file, and 10 files/chunk. Load-test against Apps Script, Drive, Sheets quotas and browser memory before production. Do not promise >100 images/day until measured.

## 5. Validation and identity

Hard validation:

- `nomor_permohonan` is present and remains a string.
- Required source headers map exactly once.
- Date/time values parse strictly; original source string is retained.
- Date ordering anomalies are warnings/review cases, not auto-corrections.
- Passport and application numbers are never coerced to numbers.
- No fuzzy matching or LLM completion of names, passport numbers, sponsor names, or dates.
- Unknown code values are preserved and flagged for reference review, not rejected solely for being new.

Candidate business identity is `nomor_permohonan` within the authorized source/Kanwil scope. Before enforcing uniqueness, verify from representative exports whether this number is globally unique and stable. Until confirmed, use a non-destructive duplicate candidate check and route conflicts to review.

Duplicate policy:

- Same file checksum: duplicate file reference; do not process again by default.
- Same scoped application number + identical normalized payload: duplicate candidate; do not create a second committed row.
- Same scoped application number + different payload: conflict; preserve both versions and require authorized resolution.
- Missing application number: review required; no commit.

## 6. Lifecycle and persistence

Proposed isolated storage objects (Sheets initially, behind a storage adapter):

- `KANWIL_IMPORT_BATCHES`: batch lifecycle, source channel, Kanwil scope, counts, contract/parser versions, actor and timestamps.
- `KANWIL_IMPORT_FILES`: private Drive file ID, checksum, MIME/size, source name, processing state, parser/OCR version and error code.
- `KANWIL_APPLICATION_STAGING`: row envelope, raw/normalized payload, validation, duplicate and review states.
- `KANWIL_APPLICATION_RECORDS`: accepted operational records and current revision.
- `KANWIL_APPLICATION_EVENTS`: append-only lifecycle and revision events.
- `KANWIL_IMPORT_AUDIT`: actor, action, before/after references, reason, correlation ID and timestamp.

Lifecycle:

`CREATED -> RECEIVED -> PARSED -> VALIDATION_REQUIRED | REVIEW_REQUIRED -> APPROVED -> COMMITTED`

Terminal/exception states: `REJECTED`, `DUPLICATE`, `CONFLICT`, `FAILED`, `CANCELLED`.

Sheets do not provide multi-sheet ACID transactions. Use lock-guarded transitions, deterministic row IDs, idempotency keys, append-only event journal, checkpointing and reconciliation. Never claim database-grade atomicity.

## 7. Authorization and privacy

Dedicated permissions, subject to the P0 gateway-authentication completion:

- `kanwil.read`
- `kanwil.import`
- `kanwil.review`
- `kanwil.commit`
- `kanwil.export`
- `kanwil.admin`

Enforce authorization server-side on every RPC. UI hiding is not a security boundary. Scope every read/write by authorized Kanwil scope. Separate permission to view aggregate reporting from permission to view identifiable application records.

Mask passport number and date of birth by default. Do not place PII in URLs, logs, error summaries, analytics, public TV endpoints, or reporting payloads. Approve source authorization, retention, deletion, backup access, and audit access before production intake.

## 8. Read-only reporting adapter

The reporting adapter is a separate read model over committed, validated Kanwil records. It must not expose staging rows or PII.

Proposed aggregate contract:

- `period` (derived from an explicitly selected business date; default reporting date must be approved)
- `kanwil_scope_id`
- `layanan`
- `kategori_produk`
- `jenis_produk`
- `tujuan`
- `status_permohonan`
- `application_count`
- `issued_count`
- `processing_count`
- `avg_payment_to_verification_seconds`
- `avg_payment_to_issue_seconds`
- `avg_verification_to_issue_seconds`
- `source_snapshot_at`, `contract_version`

Rules:

1. Reporting is read-only and derived only from committed records.
2. Counts are distinct application counts under the approved business-key rule.
3. Duration metrics use available timestamps only; negative or incomplete intervals are excluded and counted in data-quality metadata.
4. These durations are descriptive metrics, not official SLA claims.
5. Do not combine Kanwil individual application counts with canonical monthly service measures unless a separately approved semantic contract proves that the grains and definitions are compatible. Until then, display as a separate service family.
6. No names, passport numbers, dates of birth, sponsor identities, raw OCR text, or row-level details leave the restricted operational store through this adapter.

## 9. Proposed UI workspaces

1. **Kanwil Overview:** aggregate KPI, status mix, product/service mix, trend and duration distribution.
2. **Import Workspace:** Excel/CSV and screenshot/photo upload, batch queue, source provenance and parse errors.
3. **Review Workspace:** source preview side-by-side with extracted row, field-level evidence, masked PII, approve/reject/revise.
4. **Application Explorer:** permission-scoped record search and revision timeline.
5. **Audit & Data Quality:** duplicate/conflict queue, invalid dates, missing fields, import reconciliation.
6. **Reporting Connector:** read-only aggregate contract, with snapshot timestamp and data-quality indicators.

## 10. Delivery gates

- **K0 — Contract:** confirm source headers, date/time timezone, source export semantics, Kanwil scope, business-key uniqueness, authorized use and retention.
- **K1 — Security:** close P0 setup/RPC/gateway-authentication work; approve permission matrix and storage access.
- **K2 — Parser:** representative labeled Excel/CSV, screenshot and camera-photo samples; parser fixtures; fail-closed tests.
- **K3 — Staging:** isolated stores, batch lifecycle, idempotency, audit and reconciliation.
- **K4 — Review/commit:** permission-negative tests, masked PII, explicit human approval, revision/conflict handling.
- **K5 — Reporting:** read-only aggregate adapter and semantic reconciliation; no canonical dataset mutation.
- **K6 — Release:** CI, quota/load tests, security/UAT, deployment evidence, rollback and production certification.

Current posture: contract proposal only. No Kanwil runtime, RPC, storage, UI route, deployment, or production data write is implemented by this document.

## 11. Open questions that block contract freeze

1. Are timestamps exported in Asia/Jakarta, UTC, or the browser's local timezone?
2. Is `nomor_permohonan` globally unique, or unique only within a Kanwil/source period?
3. Does each export always represent one Kanwil, and how is that scope authoritatively identified?
4. Are the displayed statuses a controlled vocabulary, or can source values vary?
5. What is the approved retention period and who is authorized to access identifiable records?
6. Can the owner provide privacy-approved representative samples for all three input paths (Excel, screenshot, camera photo), with expected values?

Until these are answered, keep the contract versioned as provisional and do not activate production ingestion.


## 12. Implementation progress — contract and CSV parser prototype

The feature branch now contains `gas/KanwilPermitContract.js` with:
- the explicit 17-column Kanwil v1 schema and header aliases;
- normalized, order-independent header mapping with missing/duplicate header rejection;
- a deterministic quoted-delimited-text parser (including escaped quotes, commas inside quoted cells, CRLF and UTF-8 BOM);
- preservation of raw source values and identifiers as strings;
- strict ISO date validation for date of birth;
- timestamp timezone warnings rather than assuming a timezone;
- row-level quarantine for column-count mismatch and missing application number;
- mandatory human-review/no-auto-commit result flags.

Regression assertions were added to `gas/test-shim.js` for reordered headers, leading-zero identifiers, quoted sponsor names, timezone uncertainty, missing/duplicate headers, malformed row widths, and missing application number.

**Important limitations:** this is a pure CSV/delimited-text parser only. Native XLSX workbook decoding, screenshot OCR integration for the 17-column Kanwil contract, persistence, audit RPCs, permissions, UI route, and reporting adapter are not implemented. The parser has not been run against a representative owner-provided source file. The assertions are committed to the repository test harness, but a full GitHub Actions run has not yet been observed for the latest commit.


## 13. Implementation progress — workbook adapter, OCR geometry and shared staging contract

The isolated feature branch now also contains:

- `gas/KanwilXlsxAdapter.js`: a browser-side adapter that accepts an injected SheetJS-compatible XLSX engine, locates exactly one complete 17-column header row, converts worksheet cells through the shared CSV contract parser, and preserves worksheet row numbers. It does not bundle or fetch the XLSX library, so runtime workbook decoding is not yet wired.
- `gas/KanwilScreenshotParser.js`: a dedicated geometry parser for the 17 Kanwil columns, separate from the generic 19-column screenshot prototype. It rejects incomplete/ambiguous headers and always requires human verification.
- `gas/KanwilStagingContract.js`: a shared row envelope for all four source channels, explicit lifecycle transition rules, reason-required rejection/cancellation/conflict transitions, and a duplicate fingerprint scoped by explicit Kanwil ID plus application number.
- `gas/test-shim.js`: synthetic assertions for the XLSX adapter, header row discovery, row-number preservation, 17-column OCR geometry, staging envelope, guarded transitions, and scoped duplicate identity.

### Current implementation boundary

These are pure parser/contract prototypes, not a complete ingestion runtime. No SheetJS distribution is bundled; no real XLSX file has been parsed; no actual OCR output has been calibrated; no staging persistence, immutable revision store, duplicate-resolution transaction, private Drive upload, audit RPC, server-side permission enforcement, review UI, or reporting adapter has been implemented. GitHub Actions has not yet reported a run for the latest feature-branch commit. Do not mark these capabilities deployed or production-ready.

### Revision and duplicate policy reminder

The staging fingerprint is only a candidate identity (`kanwil_scope_id::nomor_permohonan`). It must not become a database uniqueness constraint until global/scoped uniqueness is confirmed from source exports. Conflicting payloads must retain both source versions and require an authorized reviewer. The revision store must be append-only; no source evidence or prior approved value may be overwritten.


## 14. Corrective engineering and validation — 2026-11-17

A source review found malformed generated source in the first XLSX adapter and Kanwil screenshot parser, plus an undeclared cross-module dependency in the staging helper. These were corrected before proceeding:

- Rewrote `KanwilScreenshotParser.js` as a clean 17-column module. It now retains per-field OCR word text, confidence and bounding boxes in `fieldEvidence`.
- Rewrote `KanwilXlsxAdapter.js` with explicit injected dependencies for the XLSX engine, header mapper and CSV contract parser. This keeps the module testable and avoids relying on undeclared globals.
- Corrected escaped regular expressions in `KanwilPermitContract.js` so header whitespace, BOM, line endings and strict ISO date checks behave as intended.
- Made `KanwilStagingContract.js` self-contained with its own fixed v1 field-key list rather than relying on another module's lexical constant.
- Added `KanwilOcrAdapter.js` to convert Tesseract word-level output to the 17-column geometry parser while preserving confidence and evidence. It explicitly returns `reviewRequired=true` and `autoCommit=false`.
- Added regression assertions for the OCR adapter and missing word geometry.

### Focused validation executed

The five Kanwil modules were fetched from the feature branch and parsed independently with JavaScript's syntax compiler. A focused synthetic execution then verified:
- CSV parse returns one record and preserves leading-zero passport number `016199077`.
- Quoted sponsor text containing a comma remains intact.
- 17-column screenshot parser reconstructs one synthetic row and retains field confidence.
- Staging envelope constructs successfully.
- XLSX adapter finds the header below a title row and retains worksheet row number 3.
- Direct transition from `REVIEW_REQUIRED` to `COMMITTED` is rejected.

This is focused module-level synthetic validation only. It is not the full repository `test-shim.js`, not a GitHub Actions CI pass, not a real XLSX workbook test, and not a real screenshot/photo accuracy test. The OCR UI is not yet connected to `KanwilOcrAdapter.js`; no runtime ingestion or persistence exists.
