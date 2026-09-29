# Backup Snapshot Strategy v1

## Purpose
Create a recoverable, independently stored snapshot of the verified residence-permit dataset without modifying production data.

## Snapshot contents
Each snapshot is a separate Google Spreadsheet containing:
- `RESIDENCE_PERMIT_SERVICE_MONTHLY`: header + all operational rows
- `SNAPSHOT_MANIFEST`: snapshot ID, timestamp, dataset key, schema version/signature, source spreadsheet/sheet, row count, SHA-256 checksum, completion status.

## Storage
Snapshots are stored in a dedicated Google Drive folder configured by Script Property `BACKUP_FOLDER_ID`. The production spreadsheet is never overwritten.

## Authorization
Snapshot creation and backup-folder configuration require `admin.config`.

## Integrity
The snapshot payload is canonicalized to CSV text and hashed with SHA-256. The checksum is stored in the manifest and `AUDIT_LOG`.

## Audit
Every successful snapshot creates `BACKUP_SNAPSHOT_CREATE` with actor, dataset, snapshot ID, row count, backup spreadsheet ID, and checksum.

## Operational procedure
1. Create a dedicated Google Drive backup folder.
2. Run `setBackupFolder(folderId)` once as an administrator.
3. Run `createResidencePermitSnapshot()`.
4. Verify row count and checksum.
5. Confirm `SNAPSHOT_MANIFEST.status = COMPLETE`.
6. Confirm `BACKUP_SNAPSHOT_CREATE` in `AUDIT_LOG`.

## Recovery
v1 is a controlled logical snapshot, not an automated destructive restore service. Recovery requires manifest/checksum validation and an authorized reviewed restore process.

## Non-goals
No automatic retention/deletion policy, no destructive restore endpoint, no unrelated datasets, and no credentials/secrets in snapshots.
