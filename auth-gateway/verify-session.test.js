import test from "node:test";
import assert from "node:assert/strict";
import { SignJWT } from "jose";
import handler from "./api/auth/verify-session.js";

const ENV_KEYS = [
  "GAS_GATEWAY_SHARED_SECRET",
  "APP_SESSION_SIGNING_SECRET",
  "APP_SESSION_ISSUER"
];
const originalEnv = Object.fromEntries(ENV_KEYS.map(key => [key, process.env[key]]));
const secretText = "test-only-secret-value-with-more-than-32-bytes";
const secret = new TextEncoder().encode(secretText);
const issuer = "https://gateway.example.test";

function makeResponse() {
  return {
    statusCode: 200,
    headers: {},
    body: "",
    status(code) { this.statusCode = code; return this; },
    setHeader(name, value) { this.headers[name] = value; },
    end(value = "") { this.body = value; }
  };
}

function makeRequest({ method = "POST", key, body } = {}) {
  return { method, headers: { "x-intal-gateway-key": key }, body };
}

async function signedSession(overrides = {}) {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({
    email: "approved@example.test",
    email_verified: true,
    purpose: "intal-app-session",
    ...overrides
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(issuer)
    .setAudience("intal-app")
    .setSubject("google-subject-test")
    .setIssuedAt(now)
    .setExpirationTime(now + 300)
    .setJti("test-jti")
    .sign(secret);
}

test.beforeEach(() => {
  process.env.GAS_GATEWAY_SHARED_SECRET = "service-key-test";
  process.env.APP_SESSION_SIGNING_SECRET = secretText;
  process.env.APP_SESSION_ISSUER = issuer;
});

test.after(() => {
  for (const key of ENV_KEYS) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
});

test("verify-session rejects non-POST requests", async () => {
  const res = makeResponse();
  await handler(makeRequest({ method: "GET", key: "service-key-test" }), res);
  assert.equal(res.statusCode, 405);
  assert.equal(JSON.parse(res.body).error, "METHOD_NOT_ALLOWED");
});

test("verify-session rejects a missing or incorrect service key", async () => {
  for (const key of [undefined, "wrong-key"]) {
    const res = makeResponse();
    await handler(makeRequest({ key, body: { sessionToken: "irrelevant" } }), res);
    assert.equal(res.statusCode, 401);
    assert.equal(JSON.parse(res.body).error, "SERVICE_AUTH_REQUIRED");
  }
});

test("verify-session rejects missing and oversized tokens", async () => {
  for (const sessionToken of ["", "x".repeat(8193)]) {
    const res = makeResponse();
    await handler(makeRequest({ key: "service-key-test", body: { sessionToken } }), res);
    assert.equal(res.statusCode, 400);
    assert.equal(JSON.parse(res.body).error, "INVALID_SESSION");
  }
});

test("verify-session accepts a correctly signed session and returns identity only", async () => {
  const sessionToken = await signedSession();
  const res = makeResponse();
  await handler(makeRequest({ key: "service-key-test", body: { sessionToken } }), res);
  assert.equal(res.statusCode, 200);
  const body = JSON.parse(res.body);
  assert.equal(body.valid, true);
  assert.equal(body.identity.subject, "google-subject-test");
  assert.equal(body.identity.email, "approved@example.test");
  assert.equal(body.expiresAt > Math.floor(Date.now() / 1000), true);
  assert.equal(res.headers["Cache-Control"], "no-store");
  assert.equal("sessionToken" in body, false);
});

test("verify-session rejects wrong purpose and unverified email claims", async () => {
  const badPurpose = await signedSession({ purpose: "other-purpose" });
  const unverifiedEmail = await signedSession({ email_verified: false });
  for (const sessionToken of [badPurpose, unverifiedEmail]) {
    const res = makeResponse();
    await handler(makeRequest({ key: "service-key-test", body: { sessionToken } }), res);
    assert.equal(res.statusCode, 401);
    assert.equal(JSON.parse(res.body).error, "INVALID_SESSION");
  }
});

test("verify-session fails closed when configuration is missing", async () => {
  delete process.env.APP_SESSION_SIGNING_SECRET;
  const res = makeResponse();
  await handler(makeRequest({
    key: "service-key-test",
    body: { sessionToken: await signedSession() }
  }), res);
  assert.equal(res.statusCode, 503);
  assert.equal(JSON.parse(res.body).error, "AUTH_GATEWAY_NOT_CONFIGURED");
});
