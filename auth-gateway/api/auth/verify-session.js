import { jwtVerify } from "jose";
import { timingSafeEqual } from "node:crypto";

function json(res, status, body) {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

function configured(name) {
  const value = process.env[name];
  if (!value || !value.trim()) throw new Error("MISSING_CONFIG:" + name);
  return value.trim();
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a || ""), "utf8");
  const right = Buffer.from(String(b || ""), "utf8");
  return left.length === right.length && timingSafeEqual(left, right);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return json(res, 405, { error: "METHOD_NOT_ALLOWED" });
  }

  try {
    const expectedServiceKey = configured("GAS_GATEWAY_SHARED_SECRET");
    if (!safeEqual(req.headers["x-intal-gateway-key"], expectedServiceKey)) {
      return json(res, 401, { error: "SERVICE_AUTH_REQUIRED" });
    }

    const token = typeof req.body?.sessionToken === "string" ? req.body.sessionToken : "";
    if (!token || token.length > 8192) return json(res, 400, { error: "INVALID_SESSION" });

    const secret = new TextEncoder().encode(configured("APP_SESSION_SIGNING_SECRET"));
    const { payload, protectedHeader } = await jwtVerify(token, secret, {
      issuer: configured("APP_SESSION_ISSUER"),
      audience: "intal-app",
      algorithms: ["HS256"],
      clockTolerance: 3
    });

    if (protectedHeader.typ !== "JWT" || payload.purpose !== "intal-app-session" ||
        typeof payload.sub !== "string" || !payload.sub ||
        payload.email_verified !== true || typeof payload.email !== "string" ||
        !Number.isInteger(payload.exp) || payload.exp <= Math.floor(Date.now() / 1000)) {
      return json(res, 401, { error: "INVALID_SESSION" });
    }

    return json(res, 200, {
      valid: true,
      identity: { provider: "google", subject: payload.sub, email: payload.email, name: payload.name || "" },
      expiresAt: payload.exp
    });
  } catch (error) {
    const message = String(error?.message || "");
    if (message.startsWith("MISSING_CONFIG:")) return json(res, 503, { error: "AUTH_GATEWAY_NOT_CONFIGURED" });
    return json(res, 401, { error: "INVALID_SESSION" });
  }
}
