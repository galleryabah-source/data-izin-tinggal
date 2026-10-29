import test from "node:test";
import assert from "node:assert/strict";
import handler from "../api/auth/google-login.js";

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

async function invoke({ method = "POST", origin = "https://app.example.test", body = {} } = {}) {
  const req = { method, headers: origin === null ? {} : { origin }, body };
  const res = response();
  await handler(req, res);
  return { res, body: res.body ? JSON.parse(res.body) : null };
}

test("rejects origins not in the exact allowlist", async () => {
  process.env.ALLOWED_WEB_ORIGINS = "https://app.example.test";
  const { res, body } = await invoke({ origin: "https://attacker.example.test" });
  assert.equal(res.statusCode, 403);
  assert.equal(body.error, "ORIGIN_DENIED");
  assert.equal(res.headers["access-control-allow-origin"], undefined);
});

test("rejects requests without an Origin header", async () => {
  process.env.ALLOWED_WEB_ORIGINS = "https://app.example.test";
  const { res, body } = await invoke({ origin: null });
  assert.equal(res.statusCode, 403);
  assert.equal(body.error, "ORIGIN_DENIED");
});

test("supports preflight only for an allowed origin", async () => {
  process.env.ALLOWED_WEB_ORIGINS = "https://app.example.test";
  const { res, body } = await invoke({ method: "OPTIONS" });
  assert.equal(res.statusCode, 204);
  assert.equal(body, null);
  assert.equal(res.headers["access-control-allow-origin"], "https://app.example.test");
});

test("rejects unsupported HTTP methods", async () => {
  process.env.ALLOWED_WEB_ORIGINS = "https://app.example.test";
  const { res, body } = await invoke({ method: "GET" });
  assert.equal(res.statusCode, 405);
  assert.equal(body.error, "METHOD_NOT_ALLOWED");
});

test("fails closed when OAuth configuration is missing", async () => {
  process.env.ALLOWED_WEB_ORIGINS = "https://app.example.test";
  delete process.env.GOOGLE_OAUTH_CLIENT_ID;
  const { res, body } = await invoke({ body: { credential: "not-a-real-google-token" } });
  assert.equal(res.statusCode, 503);
  assert.equal(body.error, "AUTH_GATEWAY_NOT_CONFIGURED");
});

test("rejects missing and oversized credentials", async () => {
  process.env.ALLOWED_WEB_ORIGINS = "https://app.example.test";
  process.env.GOOGLE_OAUTH_CLIENT_ID = "test-client-id.apps.googleusercontent.com";
  process.env.APP_SESSION_SIGNING_SECRET = "test-only-secret-with-at-least-32-bytes-long";
  process.env.AUTHORIZED_GOOGLE_SUBJECTS = "test-subject";
  process.env.APP_SESSION_ISSUER = "https://auth.example.test";
  const missing = await invoke({ body: {} });
  assert.equal(missing.res.statusCode, 400);
  assert.equal(missing.body.error, "INVALID_CREDENTIAL");
  const oversized = await invoke({ body: { credential: "x".repeat(12001) } });
  assert.equal(oversized.res.statusCode, 400);
  assert.equal(oversized.body.error, "INVALID_CREDENTIAL");
});
