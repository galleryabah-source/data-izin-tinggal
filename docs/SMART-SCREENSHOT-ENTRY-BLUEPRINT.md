# INTAL Smart Screenshot Entry — Technical Blueprint

**Status:** Architecture approved by product owner; implementation gated by the current P0 security work and OCR provider configuration.  
**Target repository:** `galleryabah-source/data-izin-tinggal`  
**Target runtime:** Existing Google Apps Script + Google Sheets application.  
**Timezone:** `Asia/Jakarta`  
**Scope:** Bulk extraction of immigration application rows from screenshots and camera photos.

## 1. Product decision

The owner selected:

- Image sources: both direct screenshots and camera photos.
- Volume: bulk, including more than 100 images per operational day.
- Persistence: hybrid. High-confidence records may be committed automatically only after every hard validation passes; uncertain or conflicting records require human review.

This feature is an additional ingestion channel. It is not a new application and must reuse INTAL's existing identity, server-side authorization, audit, and operational UI conventions.

## 2. Non-negotiable data boundaries

1. Do not write to or alter `RESIDENCE_PERMIT_SERVICE_MONTHLY`, `PASSPORT_SERVICE_MONTHLY`, their sheets, registry identities, importer, aggregation, GIS, or historical rows.
2. Do not route extracted individual application records through `previewImport()` or `commitImport()`; those functions are designed for governed datasets and could create or mutate registered datasets.
3. Store screenshot-derived individual application records in a separately named, restricted store with a versioned contract.
4. OCR output is untrusted input. A model/OCR engine never has authority to invent, complete, or silently correct a value.
5. No screenshot or extracted PII may be exposed through public TV endpoints, dashboard caches, client logs, analytics, or public URLs.
6. No new browser-callable RPC may be introduced until the P0 RPC/authentication review is closed. Every eventual RPC must enforce a server-side permission check and be included in the static RPC inventory and negative authorization tests.
7. No production activation or deployment is implied by this blueprint.

## 3. Source contract — screenshot table v1

One detected table row maps to one application record. The v1 contract has 19 source columns:

| # | Canonical key | Source header | Type | Handling |
|---:|---|---|---|---|
| 1 | `tanggal_pembayaran` | Tanggal Pembayaran | datetime | Nullable; preserve source timezone convention |
| 2 | `tanggal_approval_kakanim` | Tanggal Approval Kakanim | date/datetime | Nullable |
| 3 | `tanggal_mulai_verifikasi` | Tanggal Mulai Verifikasi | date/datetime | Nullable |
| 4 | `tanggal_auto_terbit` | Tanggal Auto Terbit | date/datetime | Nullable |
| 5 | `layanan` | Layanan | enum/text | Normalize whitespace/case; retain raw value |
| 6 | `kategori_produk` | Kategori Produk | enum/text | Retain raw value |
| 7 | `nomor_permohonan` | Nomor Permohonan | string | Critical identifier; never coerce to number |
| 8 | `tanggal_permohonan` | Tanggal Permohonan | datetime | Nullable only if absent in source; retain raw value |
| 9 | `penjamin` | Penjamin | text | PII/business identity; preserve spelling |
| 10 | `nama` | Nama | text | Critical PII; preserve spelling |
| 11 | `jenis_kelamin` | Jenis Kelamin | enum/text | Preserve source token |
| 12 | `tanggal_lahir` | Tanggal Lahir | date | Critical PII; strict date validation |
| 13 | `kebangsaan` | Kebangsaan | text | Preserve source token |
| 14 | `no_passport` | No. Passport | string | Critical PII; never coerce to number or change leading characters |
| 15 | `jenis_produk` | Jenis Produk | text | Preserve source token |
| 16 | `tujuan` | Tujuan | text | Preserve source token |
| 17 | `posisi_permohonan` | Posisi Permohonan | text | Preserve source token |
| 18 | `kantor_imigrasi` | Kantor Imigrasi | text/reference | Resolve against office reference where available; unresolved values require review |
| 19 | `status_permohonan` | Status Permohonan | text | Preserve source token |

### 3.1 Header aliases

Header matching must be case-insensitive and whitespace/punctuation-normalized. A versioned alias map may accept safe variants such as `No Passport`, `Nomor Paspor`, and `No. Paspor` for `no_passport`. Alias collisions or ambiguous header matches fail closed.

### 3.2 Raw and normalized values

Every extracted field stores:
- `raw_value`: exact OCR text for traceability;
- `normalized_value`: deterministic normalization only (whitespace, date parsing where unambiguous);
- `confidence`: OCR engine confidence mapped to the cell;
- `source_bbox`: cell bounding polygon/coordinates;
- `warnings[]`: parsing or mapping warnings.

Never normalize names, passport numbers, or application numbers by fuzzy correction. Keep leading zeroes and original character sequences.

## 4. Ingestion and processing architecture

### 4.1 Upload boundary

- Accept JPEG/JPG and PNG only.
- Validate declared MIME type and file signature (magic bytes); do not trust filename extension.
- Enforce per-file byte limit and image dimension/pixel limit from server configuration.
- Compute SHA-256 server-side.
- Generate a batch UUID and file UUID; client-supplied IDs are not authoritative.
- Store originals in a private, access-restricted Drive folder. Never use link-sharing.
- Bulk upload must be resumable and chunked; a browser refresh must not silently duplicate files.
- Suggested initial operating limits: 200 files per batch, 5 MB per image, 10 files per upload chunk. These are provisional limits and must be load-tested against Apps Script execution and quota limits before production.

### 4.2 Image preprocessing

Classify source as screenshot or camera photo, then:
- apply EXIF orientation;
- detect rotation and skew;
- crop table bounds without discarding edge columns;
- improve contrast/sharpness conservatively;
- retain the immutable original for review;
- record preprocessing version and output checksum.

Do not overwrite the original image.

### 4.3 OCR provider adapter

Initial provider candidate: Google Cloud Vision `DOCUMENT_TEXT_DETECTION`, invoked server-side only. Use an adapter contract so the provider can be replaced without changing extraction or persistence.

Provider configuration:
- API key/credential stored only in Script Properties or an approved secret store; never in source code, HTML, logs, or spreadsheet cells.
- Restrict credentials to the Vision API and server-side use.
- Require explicit project/billing setup, credential validation, data-processing/privacy review, and owner/security approval before enabling calls.
- Missing/invalid credentials must fail closed and leave the batch in a retryable configuration-error state.
- Do not send images to a general-purpose LLM in v1. OCR text and bounding boxes are sufficient for deterministic table reconstruction; AI-assisted interpretation can be considered later under a separate data-processing approval.

### 4.4 Table reconstruction

Use OCR word/paragraph bounding polygons to:
1. detect the header band;
2. map recognized header labels to the 19 canonical keys;
3. calculate stable x-coordinate column anchors;
4. group text fragments into row bands by y-coordinate;
5. reassemble wrapped/multiline cell text within each row/column;
6. preserve empty cells as null;
7. reject partial or ambiguous tables rather than shifting values into adjacent columns.

A table is eligible for record extraction only when the header mapping is unambiguous and the row geometry is consistent. Screenshots that omit columns, contain horizontally scrolled fragments, or have overlapping rows go to review; do not infer missing columns.

## 5. Bulk job model

Processing must be asynchronous and resumable. Do not run an unbounded 100+ image batch inside one Apps Script request.

Batch states:

`CREATED -> UPLOADING -> QUEUED -> PROCESSING -> REVIEW_REQUIRED | READY_TO_COMMIT | COMPLETED | FAILED | CANCELLED`

File states:

`UPLOADED -> PREPROCESSING -> OCR_QUEUED -> OCR_RUNNING -> EXTRACTED -> REVIEW_REQUIRED | VALIDATED | FAILED`

Worker behavior:
- acquire a script lock before claiming work;
- process a bounded number of files per execution;
- persist progress/checkpoint after each file;
- stop before Apps Script execution limits and schedule continuation;
- use bounded retry with backoff for provider/network errors;
- never retry a permanent validation error indefinitely;
- use a lease/heartbeat so abandoned jobs can be safely reclaimed;
- provide explicit cancel/retry actions with authorization and audit.

The initial 200-file batch/5 MB/file/10-file chunk limits are configuration defaults for pilot, not a promise of throughput. Measure Apps Script quotas, Vision request limits, execution duration, storage, and cost before raising them.

## 6. Confidence and hybrid persistence policy

OCR confidence is not proof of correctness. Thresholds must be calibrated against a labeled pilot set before auto-save is enabled.

Proposed pilot policy:
- Critical fields: `nomor_permohonan`, `nama`, `tanggal_lahir`, `no_passport`, `kebangsaan`, `kantor_imigrasi`.
- Non-critical fields: remaining 13 fields.
- Provisional field thresholds: critical >= 0.99; other fields >= 0.97.
- Row confidence is the minimum confidence among required/observed fields, not the average.
- Auto-save is allowed only when all 19 headers map unambiguously, all required source fields are present, all values pass deterministic validation, all critical fields meet threshold, no row/file conflict exists, and the actor has explicit commit permission.
- Any low-confidence critical value, ambiguous date, partial table, duplicate, conflicting record, unknown office, malformed identifier, or OCR warning routes to manual review.
- Do not lower thresholds merely to increase automation percentage.
- If the provider does not return reliable confidence at cell/word level, auto-save is disabled and all records require review.

The owner may configure thresholds only through an audited admin workflow. Threshold changes must be versioned and re-run against the labeled evaluation set before activation.

## 7. Validation and duplicate policy

Hard validations:
- exact header coverage and one-to-one mapping;
- required identifiers are non-empty;
- dates parse strictly and do not become dates outside the source text;
- identifier fields remain strings;
- no impossible/ambiguous date conversion;
- row has enough geometric evidence to be a single record;
- canonical office resolution is exact where the reference contract exists;
- file checksum duplicate detection;
- duplicate `nomor_permohonan` within the same batch and against the screenshot-import store.

Duplicate outcomes:
- same file checksum: mark duplicate upload and link to the original file; do not OCR again unless explicitly retried by an authorized reviewer;
- same application number + identical normalized payload: duplicate record; do not insert again;
- same application number + different payload: conflict requiring human review; never overwrite;
- missing application number: review required; do not auto-save.

No fuzzy matching may merge two people or applications automatically.

## 8. Isolated persistence model

Do not register these tables as canonical monthly datasets.

Proposed restricted sheets (or equivalent storage abstraction):

### `SCREENSHOT_IMPORT_BATCHES`
`batch_id, status, total_files, uploaded_files, processed_files, extracted_rows, review_rows, committed_rows, failed_files, created_by, created_at, updated_at, contract_version, extractor_version, threshold_profile_version, error_summary`

### `SCREENSHOT_IMPORT_FILES`
`file_id, batch_id, original_name, mime_type, byte_size, sha256, private_drive_file_id, upload_status, processing_status, ocr_provider, ocr_version, preprocessing_version, uploaded_by, uploaded_at, processed_at, error_code, error_detail`

### `SCREENSHOT_IMPORT_ROWS`
`row_id, batch_id, file_id, source_row_index, application_number, raw_json, normalized_json, field_confidence_json, source_bbox_json, validation_status, review_status, commit_status, duplicate_of, revision, created_at, updated_at`

### `SCREENSHOT_IMPORT_AUDIT`
`event_id, batch_id, file_id, row_id, actor, action, before_json, after_json, reason, correlation_id, timestamp`

Use append-only audit events. Restrict spreadsheet access to the application service account/owners and authorized operators. The UI must mask passport number and date of birth by default. Never place PII in error summaries, client logs, URLs, or notifications.

Google Sheets does not provide multi-sheet ACID transactions. The implementation must use a lock-guarded state machine, write journal/checkpoints, idempotent row keys, and a reconciliation routine. Do not claim atomic commit semantics that the platform cannot guarantee.

## 9. Authorization model

Add dedicated permissions; do not reuse `dataset.import` as a substitute:

- `screenshot.read`
- `screenshot.upload`
- `screenshot.process`
- `screenshot.review`
- `screenshot.commit`
- `screenshot.admin`

Role assignment is an explicit migration/review item. Proposed least-privilege mapping:
- ADMIN: all screenshot permissions;
- SUPERVISOR: read, review, commit;
- OPERATOR: read, upload, process, edit own uncommitted rows;
- AUDITOR: read metadata/audit only, with PII masking;
- VIEWER: no screenshot PII access by default.

Every server-callable function must call `requirePermission_` (or the approved gateway-backed authorization wrapper after the authentication migration). UI visibility is not authorization. The upload, OCR, review, commit, retry, cancel, and admin operations each require independent permission checks.

Current P0 security PRs #248 and #249 must be resolved before new RPC endpoints or the feature route are exposed. The feature must then be added to the RPC inventory and tested against anonymous, inactive, wrong-role, and revoked-permission users.

## 10. UI/UX scope

Add a dedicated Screenshot Entry workspace with:
- drag/drop and multi-file selection;
- camera/photo upload on mobile;
- batch queue and resumable upload;
- per-file thumbnail and status;
- processing progress and retry;
- extracted-row table with column-level confidence indicators;
- side-by-side source image and editable structured record;
- masked passport display with explicit reveal permission;
- filters for valid, review, duplicate, conflict, failed;
- bulk confirmation only for rows that independently pass every auto-commit gate;
- export of non-sensitive operational metadata only, unless separately authorized.

The UI must not show a successful save until the server confirms the persisted outcome.

## 11. API/RPC contract proposal

Names below are proposed only; do not expose until the security gate is closed.

- `createScreenshotBatch(metadata)`
- `uploadScreenshotFile(batchId, filePayload)`
- `getScreenshotBatch(batchId)`
- `processScreenshotBatch(batchId)`
- `listScreenshotRows(batchId, filters)`
- `updateScreenshotRow(rowId, patch, reason)`
- `commitScreenshotRows(batchId, rowIds, idempotencyKey)`
- `retryScreenshotFile(fileId)`
- `cancelScreenshotBatch(batchId, reason)`

All IDs are server-generated UUIDs. All mutation endpoints validate actor permissions, batch ownership/scope, contract version, idempotency, and state transition on the server.

## 12. Delivery gates

### Gate A — Security and provider readiness
- [ ] P0 setup RPC and daily-input bypass fixes merged and verified.
- [ ] Complete RPC inventory/authentication boundary review closed.
- [ ] Approved permission matrix and restricted storage access.
- [ ] OCR provider, project, billing, credentials, and data-processing review approved.
- [ ] Retention/deletion policy approved.

### Gate B — Contract and deterministic parser
- [ ] 19-column v1 contract and alias registry frozen.
- [ ] Labeled sample screenshots include direct screenshots and camera photos.
- [ ] Table geometry parser has fixtures for wrapped text, blank cells, low resolution, skew, partial columns, and overlapping rows.
- [ ] Field-level confidence and raw bounding boxes are retained.
- [ ] Duplicate/conflict tests pass.

### Gate C — Runtime implementation
- [ ] Private file storage and resumable bulk upload.
- [ ] Bounded queue worker, checkpoint, retry, lease, cancellation.
- [ ] Review workspace and masked PII.
- [ ] Dedicated permissions and audit events.
- [ ] Isolated screenshot record store.
- [ ] No writes to monthly datasets/importer/registry.

### Gate D — Validation and controlled activation
- [ ] Unit, parser fixture, concurrency/idempotency, authorization-negative, audit-failure, and quota tests pass.
- [ ] Labeled pilot accuracy meets owner-approved thresholds.
- [ ] Bulk load test for >100 images/day passes with measured execution/cost.
- [ ] Production UAT verifies upload → OCR → review/auto-save → audit → monitoring.
- [ ] Deployment evidence and rollback/disable switch recorded.
- [ ] Production certification is separate from implemented/deployed status.

## 13. Explicit non-goals for v1

- No direct connection to the source immigration application.
- No scraping or bypassing access controls.
- No automated correction of source application data.
- No write-back to the source application.
- No change to daily-input Gate 9.1 or its code-level kill switch.
- No write to canonical Residence/Passport monthly datasets.
- No LLM-based completion of unreadable personal data.
- No automatic overwriting of previously captured application records.

## 14. Open implementation prerequisites

1. Confirm the authorized source system/export context and the permitted use/retention of the personal data shown in screenshots.
2. Approve Google Cloud Vision as the initial OCR processor (or select an approved equivalent) and configure server-only credentials.
3. Supply a representative labeled sample set containing both screenshot and camera-photo inputs, including examples with all 19 columns and known expected values.
4. Close P0 security PRs #248/#249 before adding any browser-callable server functions.
5. Calibrate confidence thresholds using the labeled set; until then, keep auto-save disabled and route all records to review.

**Release posture:** design approved; no OCR provider calls, persistent screenshot tables, RPC exposure, production data writes, merge, or deployment are authorized by this document alone.
