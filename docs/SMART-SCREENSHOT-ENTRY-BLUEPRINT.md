# INTAL Smart Screenshot Entry — Technical Blueprint

**Status:** Cost-free architecture selected; implementation gated by the current P0 security work, sample validation, and browser-runtime compatibility.  
**Target repository:** `galleryabah-source/data-izin-tinggal`  
**Target runtime:** Existing Google Apps Script + Google Sheets application.  
**Timezone:** `Asia/Jakarta`  
**Scope:** Bulk extraction of immigration application rows from screenshots and camera photos.

## 1. Product decision

The owner selected:

- Image sources: both direct screenshots and camera photos.
- Volume: bulk, including more than 100 images per operational day.
- Persistence: hybrid. Original images remain in the existing private Drive storage and extracted records remain in isolated Sheets storage. OCR runs locally in the user's browser; every extracted row requires human confirmation before commit in v1.

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

**No paid OCR provider is used in v1.** OCR runs in the browser using the open-source Tesseract.js engine (WebAssembly) with Indonesian/English language data as needed. Image pixels are processed on the user's device; screenshots are not uploaded to an OCR API and no OCR API key, cloud project, or billing account is required.

Implementation constraints:
- Pin and review the Tesseract.js and trained-data versions. Prefer serving pinned assets from an already available application asset origin; if a public CDN is used, it is only for downloading the open-source runtime/language files and must not receive image content.
- Run OCR in a Web Worker so the UI remains responsive; cap worker count and memory use, and process files sequentially or in small bounded groups.
- Keep image processing and OCR in the browser. Only after user confirmation may the structured record and the original image be sent to existing authorized INTAL storage.
- If browser memory, device performance, network access to static assets, or language-data availability prevents OCR, mark the file `REVIEW_REQUIRED`; do not fall back to a paid/cloud OCR service.
- Tesseract confidence is not reliable cell-level evidence for table reconstruction. Therefore v1 does not auto-commit OCR results. Every row is reviewed and explicitly committed by an authorized operator.
- Do not send images or OCR text to a general-purpose LLM or any external OCR endpoint in v1.

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

Processing must be asynchronous and resumable. Browser-side OCR is performed in bounded chunks and persisted progress is checkpointed through the existing app only after authorization; do not run an unbounded batch in one browser task or Apps Script request.

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
- Browser OCR confidence is advisory only; it is not a correctness guarantee and is not treated as cell-level proof.
- **Auto-save/auto-commit is disabled in v1.** Every extracted row is shown beside its source image and requires explicit operator review and commit.
- Any low-confidence text, ambiguous date, partial table, duplicate, conflicting record, unknown office, malformed identifier, or OCR warning is highlighted for manual correction or rejection.
- No cloud OCR fallback is permitted, even when local OCR fails.

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
- [ ] Local Tesseract.js runtime and language-data versions pinned, reviewed, and tested without paid APIs.
- [ ] Browser asset delivery confirmed without introducing a paid hosting dependency.
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
- [ ] Labeled pilot accuracy and human-review workload measured on representative devices.
- [ ] Bulk load test for >100 images/day passes within existing browser, Apps Script, Drive, and Sheets quotas; no paid OCR fallback.
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
2. Supply a representative labeled sample set containing both screenshot and camera-photo inputs, including examples with all 19 columns and known expected values.
3. Validate Tesseract.js compatibility with the Apps Script HTML sandbox and existing deployment asset path; if that is not viable, stop and return a manual-review workflow rather than introducing paid services.
4. Close P0 security PRs #248/#249 before adding any browser-callable server functions.
5. Measure local OCR accuracy, browser memory, throughput, and review effort; auto-commit remains disabled in v1.

## 15. Zero-additional-cost operating rule

The owner requires **Rp0 additional recurring or usage-based cost** for this feature. Accordingly:

- Prohibited in v1: Google Cloud Vision, paid OCR APIs, paid AI APIs, new hosting/CDN subscriptions, new database subscriptions, paid automation services, or any fallback that can incur per-request charges.
- Reuse only the existing INTAL Apps Script deployment, existing authorized Drive storage, and existing Sheets capacity. Do not upgrade Google Workspace/Drive or enable a paid service to make this feature work.
- Use browser-local open-source OCR. The browser downloads static runtime/language assets; image content remains on-device until the operator explicitly submits it to the existing INTAL storage workflow.
- Enforce storage and execution quotas. If existing free capacity is insufficient, pause intake and show a capacity warning; never trigger a paid upgrade or silently route to a paid provider.
- “Rp0 additional cost” means no new paid service or metered API is introduced. It does not guarantee unlimited storage, bandwidth, device resources, or Google account capacity; those remain subject to existing account quotas.

**Release posture:** cost-free architecture documented; no OCR provider calls, persistent screenshot tables, RPC exposure, production data writes, merge, or deployment are authorized by this document alone.


## 16. Implementation progress — isolated prototype

The current feature branch contains:
- `gas/ScreenshotEntry.html`: isolated browser-only multi-image intake and Tesseract.js prototype. It does not upload, persist, call Apps Script RPC, or expose a production route.
- `gas/ScreenshotTableParser.js`: pure deterministic geometry parser prototype that accepts OCR word bounding boxes, attempts exact 19-column header mapping, assigns words to x-coordinate columns, and rejects incomplete/ambiguous headers.
- `gas/test-shim.js`: source-level regression assertions plus a synthetic 19-column geometry fixture and incomplete-header rejection test.

A direct isolated execution of the parser against the synthetic fixture returned one reconstructed row, retained application/passport identifiers as strings, and rejected an 18-column header. This is a synthetic unit check only—not a real screenshot accuracy result, not the full repository CI run, and not proof of production readiness.

Known parser limitations before real-sample calibration:
- Header word grouping uses a provisional pixel-gap heuristic; zoom, resolution, table density, and wrapped headers can change it.
- The current geometry parser does not yet resolve merged cells, multiline/wrapped row values, horizontally scrolled partial tables, or repeated header bands.
- The parser currently returns raw strings only; strict per-field date/identifier/office validation and duplicate detection remain unimplemented.
- The OCR UI currently displays raw text and is not yet connected to the geometry parser.
- No Drive/Sheets persistence, audit RPC, role/permission migration, or production route has been implemented.

Do not enable or deploy this prototype as an operational feature until representative, privacy-approved samples from both source types are supplied, the parser is calibrated against labeled expected values, and the P0 security/authentication gates are closed.
