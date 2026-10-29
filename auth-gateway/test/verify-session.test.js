import test from "node:test";
import assert from "node:assert/strict";
import { SignJWT } from "jose";
import handler from "../api/auth/verify-session.js";

const SECRET = "test-only-secret-with-at-least-32-bytes-long";
const SERVICE_KEY = "test-service-secret";
const ISSUER = "https://auth.example.test";

function response() {
  return {
    statusCode: 200,
    headers: {},
    body: "",
    status(code) { this.statusCode = code; return this; },
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    end(body = "") { this.body = body; }
  };
}

function request({ method = "POST", key = SERVICE_KEY, token = "" } = {}) {
  return {
    method,
    headers: key === null ? {} : { "x-intal-gateway-key": key },
    body: { sessionToken: token }
  };
}

async function signedToken({ exp = Math.floor(Date.now() / 1000) + 120, sub = "google-subject-1" } = {}) {
  return new SignJWT({
    email: "owner@example.test",
    email_verified: true,
    name: "Test Owner",
    purpose: "intal-app-session"
  }).setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(ISSUER)
    .setAudience("intal-app")
    .setSubject(sub)
    .setIssuedAt(Math.floor(Date.now() / 1000))
    .setExpirationTime(exp)
    .sign(new TextEncoder().encode(SECRET));
}

async function invoke(req) {
  const res = response();
  await handler(req, res);
  return { res, body: JSON.parse(res.body || "{}") };
}

test("rejects non-POST methods", async () => {
  const { res, body } = await invoke(request({ method: "GET" }));
  assert.equal(res.statusCode, 405);
  assert.equal(body.error, "METHOD_NOT_ALLOWED");
});

test("fails closed when service key is absent or incorrect", async () => {
  process.env.GAS_GATEWAY_SHARED_SECRET = SERVICE_KEY;
  const missing = await invoke(request({ key: null }));
  assert.equal(missing.res.statusCode, 401);
  assert.equal(missing.body.error, "SERVICE_AUTH_REQUIRED");
  const wrong = await invoke(request({ key: "wrong", token: "not-a-token" }));
  assert.equal(wrong.res.statusCode, 401);
  assert.equal(wrong.body.error, "SERVICE_AUTH_REQUIRED");
});

test("accepts a valid signed session only for the authenticated service", async () => {
  process.env.GAS_GATEWAY_SHARED_SECRET = SERVICE_KEY;
  process.env.APP_SESSION_SIGNING_SECRET = SECRET;
  process.env.APP_SESSION_ISSUER = ISSUER;
  const token = await signedToken();
  const { res, body } = await invoke(request({ token }));
  assert.equal(res.statusCode, 200);
  assert.equal(res.headers["cache-control"], "no-store");
  assert.equal(body.valid, true);
  assert.equal(body.identity.subject, "google-subject-1");
  assert.equal(body.identity.email, "owner@example.test");
  assert.equal(body.identity.provider, "google");
  assert.ok(Number.isInteger(body.expiresAt));
});

test("rejects expired sessions", async () => {
  process.env.GAS_GATEWAY_SHARED_SECRET = SERVICE_KEY;
  process.env.APP_SESSION_SIGNING_SECRET = SECRET;
  process.env.APP_SESSION_ISSUER = ISSUER;
  const token = await signedToken({ exp: Math.floor(Date.now() / 1000) - 30 });
  const { res, body } = await invoke(request({ token }));
  assert.equal(res.statusCode, 401);
  assert.equal(body.error, "INVALID_SESSION");
});

test("fails closed when session signing configuration is missing", async () => {
  process.env.GAS_GATEWAY_SHARED_SECRET = SERVICE_KEY;
  delete process.env.APP_SESSION_SIGNING_SECRET;
  delete process.env.APP_SESSION_ISSUER;
  const { res, body } = await invoke(request({ token: "not-a-token" }));
  assert.equal(res.statusCode, 503);
  assert.equal(body.error, "AUTH_GATEWAY_NOT_CONFIGURED");
});
