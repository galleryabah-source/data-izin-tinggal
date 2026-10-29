/**
 * Google gateway session verification seam.
 *
 * SECURITY: This helper is not active until every protected RPC explicitly passes
 * its session token and uses requireGatewayPermission_ / requireGatewayBackOfficeAccess_.
 * Never store a per-user session token in Script Properties or CacheService.
 *
 * Script Properties required:
 *   INTAL_GATEWAY_VERIFY_URL = exact HTTPS URL for /api/auth/verify-session
 *   GAS_GATEWAY_SHARED_SECRET = server-to-server secret matching the gateway
 */
function verifyGatewaySession_(sessionToken) {
  const token = typeof sessionToken === 'string' ? sessionToken.trim() : '';
  if (!token || token.length > 8192) throw new Error('UNAUTHENTICATED');

  const props = PropertiesService.getScriptProperties();
  const verifyUrl = String(props.getProperty('INTAL_GATEWAY_VERIFY_URL') || '').trim();
  const sharedSecret = String(props.getProperty('GAS_GATEWAY_SHARED_SECRET') || '').trim();
  if (!verifyUrl || !sharedSecret || !/^https:\/\//i.test(verifyUrl)) {
    throw new Error('AUTH_GATEWAY_NOT_CONFIGURED');
  }

  let response;
  try {
    response = UrlFetchApp.fetch(verifyUrl, {
      method: 'post',
      contentType: 'application/json',
      headers: { 'x-intal-gateway-key': sharedSecret },
      payload: JSON.stringify({ sessionToken: token }),
      muteHttpExceptions: true,
      followRedirects: false
    });
  } catch (err) {
    // Fail closed; never fall back to the Apps Script active-user email.
    throw new Error('AUTH_GATEWAY_UNAVAILABLE');
  }

  if (response.getResponseCode() !== 200) throw new Error('UNAUTHENTICATED');

  let result;
  try {
    result = JSON.parse(response.getContentText() || '{}');
  } catch (err) {
    throw new Error('AUTH_GATEWAY_INVALID_RESPONSE');
  }
  const identity = result && result.valid === true ? result.identity : null;
  const subject = identity && typeof identity.subject === 'string' ? identity.subject.trim() : '';
  const email = identity && typeof identity.email === 'string' ? identity.email.trim().toLowerCase() : '';
  const expiresAt = Number(result && result.expiresAt);
  if (!subject || !email || !Number.isFinite(expiresAt) || expiresAt <= Math.floor(Date.now() / 1000)) {
    throw new Error('UNAUTHENTICATED');
  }

  // Map stable Google sub to one active USERS row; email alone is not an identity key.
  const sheet = getDb_().getSheetByName(SHEETS.USERS);
  if (!sheet) throw new Error('AUTH_USER_DIRECTORY_UNAVAILABLE');
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) throw new Error('UNAUTHENTICATED');
  const headers = values[0].map(x => String(x || '').trim());
  const requiredHeaders = ['google_sub', 'status', 'email', 'user_id', 'display_name', 'role'];
  const headerCounts = Object.fromEntries(requiredHeaders.map(name =>
    [name, headers.filter(header => header === name).length]
  ));
  if (requiredHeaders.some(name => headerCounts[name] === 0)) {
    throw new Error('AUTH_USER_DIRECTORY_NOT_CONFIGURED');
  }
  // Duplicate security-sensitive headers are ambiguous; never silently select the first.
  if (requiredHeaders.some(name => headerCounts[name] !== 1)) {
    throw new Error('AUTH_USER_DIRECTORY_HEADERS_AMBIGUOUS');
  }
  const subjectIndex = headers.indexOf('google_sub');
  const statusIndex = headers.indexOf('status');
  const emailIndex = headers.indexOf('email');
  const userIdIndex = headers.indexOf('user_id');
  const nameIndex = headers.indexOf('display_name');
  const roleIndex = headers.indexOf('role');

  const matches = values.slice(1).filter(row =>
    String(row[subjectIndex] || '').trim() === subject &&
    String(row[statusIndex] || '').trim().toUpperCase() === 'ACTIVE'
  );
  if (matches.length !== 1) throw new Error('UNAUTHENTICATED');
  const row = matches[0];
  const storedEmail = String(row[emailIndex] || '').trim().toLowerCase();
  const role = String(row[roleIndex] || '').trim().toUpperCase();
  if (!storedEmail || storedEmail !== email || !role) throw new Error('UNAUTHENTICATED');

  return {
    authenticated: true,
    provider: 'google',
    subject: subject,
    email: storedEmail,
    userId: String(row[userIdIndex] || ''),
    displayName: String(row[nameIndex] || ''),
    role: role,
    permissions: getRolePermissions_(role),
    sessionExpiresAt: expiresAt
  };
}

function requireGatewayPermission_(permission, sessionToken) {
  const user = verifyGatewaySession_(sessionToken);
  if (!user.permissions.includes(permission)) throw new Error('FORBIDDEN: ' + permission);
  return user;
}

function requireGatewayBackOfficeAccess_(sessionToken) {
  const user = verifyGatewaySession_(sessionToken);
  if (!BACKOFFICE_ROLES_.includes(user.role)) throw new Error('BACKOFFICE_ACCESS_DENIED');
  return user;
}
