# Kanwil Drive Upload and Activation

## Owner-provided resources

- Staging spreadsheet: `1hK0ClWkKcUhvne7yXYXYqvMQW7L-R2tuGOTVyzSVBWE`
- Drive archive folder: `1oo5_9s4ohZK6ydLXUIuy7-enGk5-BXFo`
- Scope: `KANWIL_JABAR`

## What this change does

1. The browser reads a selected file and computes a client SHA-256.
2. The browser sends the original bytes (base64) and parsed structured rows to the protected Apps Script RPC.
3. The server decodes the bytes, verifies byte length and independently recomputes SHA-256.
4. The server writes the original file into the configured Drive folder.
5. The server persists Drive file ID/URL, server checksum, storage state, file metadata, and normalized rows in the isolated Kanwil spreadsheet.
6. If a subsequent spreadsheet write fails, the transaction compensates by rolling back appended rows and moving the newly created Drive file to Trash.

The upload size is capped at 10 MiB per file because the original bytes travel through `google.script.run` as base64. Uploads are not sent to the parser CDN.

## One-time activation

After this change is merged and deployed, an authorized back-office owner must run `activateKanwilStorageFromOwnerTargetsV1()` from the Apps Script editor.

The helper:

- Verifies the staging spreadsheet is distinct from the canonical spreadsheet.
- Writes the three owner-approved Script Properties.
- Provisions the eight Kanwil tabs and performs an additive migration of the prior 15-column `KANWIL_FILES` header.
- Marks legacy file rows `LEGACY_NOT_ARCHIVED`; it does not invent Drive IDs or claim old files were archived.
- Creates and immediately trashes a temporary file to verify Drive write permission.
- Sets `KANWIL_STAGING_ENABLED=true` only after schema and Drive write checks succeed.

If any step fails, the feature flag remains OFF. The owner should inspect the thrown error and Drive/Spreadsheet permissions before retrying.

## Runtime verification

Open the Kanwil entry page and confirm its initialization status reports storage and Drive archive ready. Then perform a controlled test using a non-sensitive CSV/XLSX file under 10 MiB:

- Confirm a Drive file appears in the owner-provided folder.
- Confirm `KANWIL_FILES` contains matching `drive_file_id`, `drive_file_url`, `storage_status=STORED`, and `server_verified_sha256`.
- Confirm the related batch and parsed rows appear in `KANWIL_BATCHES` and `KANWIL_STAGING`.
- Confirm the server checksum equals the source file checksum.
- Confirm reviewer approval and separate committer controls remain enforced.

Do not use production personal data for the first smoke test.

## OCR status

Screenshot/photo OCR remains browser-local in this release. Extracted rows must be reviewed by an operator before persistence. This release does not claim cloud OCR. Cloud OCR requires an approved provider/API, billing/project authorization, credentials, privacy review, and retention policy.

## Data isolation

All Kanwil writes remain within the dedicated Kanwil staging spreadsheet and Drive folder. Canonical Residence/Passport monthly datasets and Daily Input Gate 9.1 are not modified.
