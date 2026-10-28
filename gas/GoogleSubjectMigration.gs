/**
 * Non-destructive USERS schema migration for Google OAuth subject mapping.
 *
 * This migration only appends the `google_sub` column. It does not enroll
 * accounts or assign subjects. Enrollment must be a separate verified,
 * admin-controlled operation after identity proofing.
 *
 * Safe to re-run: if the column already exists, no schema write is performed.
 * Does not touch canonical monthly datasets or daily-input storage.
 */
function migrateGoogleSubjectColumnV1() {
  requirePermission_('admin.users');

  const db = getDb_();
  const sheet = db && db.getSheetByName(SHEETS.USERS);
  if (!sheet) throw new Error('USERS_SHEET_NOT_FOUND');

  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();
  if (lastRow < 1 || lastColumn < 1) throw new Error('USERS_SCHEMA_NOT_INITIALIZED');

  const headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0]
    .map(function (value) { return String(value || '').trim().toLowerCase(); });
  const matches = [];
  headers.forEach(function (header, index) {
    if (header === 'google_sub') matches.push(index + 1);
  });
  if (matches.length > 1) throw new Error('USERS_GOOGLE_SUB_HEADER_AMBIGUOUS');
  if (matches.length === 1) {
    return { ok: true, changed: false, column: matches[0], reason: 'ALREADY_PRESENT' };
  }

  const newColumn = lastColumn + 1;
  sheet.getRange(1, newColumn).setValue('google_sub');
  SpreadsheetApp.flush();

  // Verify the persisted header before reporting success.
  const persisted = String(sheet.getRange(1, newColumn).getValue() || '').trim().toLowerCase();
  if (persisted !== 'google_sub') throw new Error('USERS_GOOGLE_SUB_MIGRATION_VERIFY_FAILED');
  return { ok: true, changed: true, column: newColumn, reason: 'COLUMN_APPENDED' };
}

/**
 * Admin-only diagnostic. Reports mapping readiness without returning subject
 * values or user PII. Does not enroll, update, or delete any account mapping.
 */
function getGoogleSubjectMappingReadinessV1() {
  requirePermission_('admin.users');
  const sheet = getDb_().getSheetByName(SHEETS.USERS);
  if (!sheet || sheet.getLastRow() < 1 || sheet.getLastColumn() < 1) {
    return { ok: false, ready: false, reason: 'USERS_SCHEMA_NOT_INITIALIZED' };
  }
  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(function (value) { return String(value || '').trim().toLowerCase(); });
  const subjectIndexes = [];
  const statusIndexes = [];
  headers.forEach(function (header, index) {
    if (header === 'google_sub') subjectIndexes.push(index);
    if (header === 'status') statusIndexes.push(index);
  });
  if (subjectIndexes.length !== 1) {
    return { ok: true, ready: false, reason: subjectIndexes.length ? 'AMBIGUOUS_SUBJECT_COLUMN' : 'MIGRATION_REQUIRED' };
  }
  if (statusIndexes.length !== 1) {
    return { ok: true, ready: false, reason: 'STATUS_COLUMN_AMBIGUOUS_OR_MISSING' };
  }

  const seen = Object.create(null);
  let activeWithoutSubject = 0;
  let duplicateSubjects = 0;
  for (let row = 1; row < values.length; row++) {
    const status = String(values[row][statusIndexes[0]] || '').trim().toLowerCase();
    const subject = String(values[row][subjectIndexes[0]] || '').trim();
    if (status === 'active' && !subject) activeWithoutSubject++;
    if (subject) {
      if (seen[subject]) duplicateSubjects++;
      else seen[subject] = true;
    }
  }
  return {
    ok: true,
    ready: duplicateSubjects === 0 && activeWithoutSubject === 0,
    activeWithoutSubject: activeWithoutSubject,
    duplicateSubjects: duplicateSubjects,
    enrolledSubjects: Object.keys(seen).length
  };
}
