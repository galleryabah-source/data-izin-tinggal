# Kanwil Source-File Preservation and Independent Verification

## Status

**Design contract only — not implemented, not deployed, and not enabled.**

The current Kanwil import path parses CSV/XLSX in the browser. The browser sends file metadata, a client-computed SHA-256, parser row counts, and a source-row manifest to Apps Script. Apps Script validates the submitted evidence for internal consistency and later detects staging drift. It does not receive the original bytes and therefore cannot independently prove the file digest or source row count.

This document defines the next safe implementation boundary. It does not authorize a Drive folder, retention period, access policy, or production activation.

## Security invariants

1. Original source bytes must reach the Apps Script server before independent verification is claimed.
2. The server computes SHA-256 from the received bytes. A client-supplied digest is only a comparison value, never the trusted digest.
3. The server preserves the exact original bytes in a dedicated, owner-approved restricted Drive folder.
4. The archive folder must not be the canonical spreadsheet's folder by default, a user's personal working folder, or a publicly/shared-link accessible folder.
5. Archive metadata is append-only from the application's perspective. No replacement or overwrite of an existing archived source file is permitted.
6. The archive file ID, server digest, byte length, MIME type, source channel, actor, timestamp, and parser version are bound to the Kanwil batch/file record and audit trail.
7. A failed archive, digest comparison, parser verification, or metadata write must fail closed. No staging rows are created.
8. KANWIL_STAGING_ENABLED remains OFF until a separately approved runtime UAT. This work must not touch canonical Residence/Passport datasets, importer, registry, monthly baselines, or Daily Input Gate 9.1.
9. No source file contents, applicant PII, or Drive credentials are stored in Script Properties. Only the approved folder ID and non-secret feature/configuration values may be stored there.
10. No public file URLs or broad Drive sharing are permitted.

## Proposed server-side intake sequence

1. Browser selects a source file and sends the original bytes (base64-encoded only for transport) together with filename, declared MIME type, and declared size.
2. Protected Apps Script RPC authenticates back-office access, validates the feature flag, validates configured archive folder ID, and enforces a strict byte-size limit before any write.
3. Server decodes bytes, checks actual byte length and allowed file signature/type, computes SHA-256 from the bytes, and compares it with the browser's optional digest.
4. Server creates a new Drive file in the dedicated restricted folder using a generated opaque filename. It never trusts a path or Drive file ID supplied by the browser.
5. Server reads the stored file back and recomputes SHA-256 to verify preservation. If this check fails, it attempts to trash the just-created file and aborts.
6. Server parses the archived bytes using a server-side parser, not the browser parser, and creates the authoritative row count and ordered source-row manifest.
7. Server persists the archive ID and server-computed evidence in the Kanwil file metadata and audit record.
8. The browser parser may still be used for preview, but preview results are compared with the server parser result. A mismatch blocks staging.
9. Only after archive, hash, parser, and metadata checks all succeed may the same request continue to staging persistence under a ScriptLock and rollback checkpoint.

## Parser support boundary

### CSV

Apps Script Utilities.parseCsv can be used as a server-side parser, but the implementation must define and test:
- UTF-8 handling and BOM removal;
- quoted delimiters, escaped quotes, embedded newlines, CRLF/LF;
- empty logical records and trailing blank lines;
- header detection and the exact non-empty data-row counting rule;
- source row number preservation;
- malformed/uneven column handling;
- maximum columns, rows, and file bytes.

The authoritative row count must use the same documented contract as the browser parser, with fixtures proving equivalence. A simple line split is not acceptable because quoted CSV fields can contain newlines.

### XLSX

Apps Script does not provide a native XLSX parser. Do not label XLSX row counts as independently verified until one of these approaches is selected and tested:

- **Preferred candidate:** bundle a reviewed, pinned SheetJS build into the Apps Script server runtime, with a recorded upstream version/commit, license review, integrity hash, and server-side fixtures.
- **Alternative:** use an explicitly enabled Google Drive API conversion workflow in a restricted temporary area, with conversion fidelity tests and cleanup verification.

The browser-only SheetJS parser currently in use is not sufficient for independent server verification.

### Screenshot and camera/OCR

Physical source-row count remains UNAVAILABLE unless a separately approved OCR workflow can preserve page/image provenance and produce reviewable evidence. OCR candidate rows remain human-review-only. Do not infer a source row count from the number of OCR candidates.

## Proposed configuration and schema (not yet implemented)

Configuration:
- KANWIL_SOURCE_ARCHIVE_ENABLED — default OFF.
- KANWIL_SOURCE_ARCHIVE_FOLDER_ID — dedicated owner-approved restricted Drive folder ID.
- Maximum upload bytes — explicit code constant with tests; do not infer from browser file size.
- Allowed MIME/signature matrix — explicit code allowlist.

Proposed KANWIL_FILES additions:
- archive_drive_file_id
- server_source_file_sha256
- server_verified_byte_size
- server_parser_version
- server_source_data_row_count
- server_parsed_record_count
- server_source_row_manifest_sha256
- server_verification_status
- server_verified_at

The existing source_file_sha256 and source_evidence_status=CLIENT_ATTESTED fields must remain distinguishable from server-computed evidence during migration. Never silently reinterpret legacy client attestations as server verified.

## Required owner decisions before enabling implementation

The following values cannot safely be inferred from the repository:
1. Dedicated restricted Drive folder ID and confirmation that the deploying account owns/manages it.
2. Who may view/download source files (minimum roles and exact Workspace group/email allowlist).
3. Retention period and deletion/hold process for source files containing immigration applicant personal data.
4. Maximum accepted source file size and expected peak batch size.
5. XLSX server parser choice: pinned SheetJS bundle or Drive API conversion.
6. Whether screenshots/OCR are in scope for the first release (recommended: keep excluded).

Until those decisions are supplied and verified, the archive RPC must not be enabled and no Drive files should be written.

## Acceptance tests required before UAT

- Missing/invalid folder ID; folder inaccessible to executing account; folder equals a prohibited canonical location.
- Empty, malformed, oversized, MIME-spoofed, and signature-mismatched uploads.
- Browser digest differs from server digest.
- Stored-file digest differs from upload digest.
- Duplicate upload retries are idempotent without creating duplicate Drive files.
- Same file hash with conflicting parser version/scope/channel fails closed.
- CSV fixtures cover BOM, CRLF, quoted comma, escaped quote, embedded newline, blank rows, malformed records, and header offsets.
- XLSX fixtures cover multiple sheets, blank rows, hidden sheets, merged cells, formulas/cached values, date cells, malformed workbook, and row offsets.
- Browser/server parser mismatch blocks staging.
- Drive create succeeds but metadata write fails; compensation/cleanup and recovery evidence are tested.
- Drive ACL and sharing posture are manually verified by the owner before UAT.
- Audit records contain actor, batch/file correlation, archive ID, server digest, and outcome without duplicating applicant PII.
- Feature flag OFF rejects all archive writes.
- Regression confirms canonical monthly datasets and Gate 9.1 remain unchanged.

## Current truth

- Existing import path: browser parse + client-attested source evidence.
- Independent server-side source verification: NOT IMPLEMENTED.
- Restricted Drive archive: NOT CONFIGURED.
- Source archive feature flag: NOT CONFIGURED / MUST REMAIN OFF.
- Kanwil staging feature flag: OFF.
- No staging workbook provisioning or source-file upload is performed by this design document.
