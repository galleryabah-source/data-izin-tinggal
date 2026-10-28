import { OAuth2Client } from "google-auth-library";
import { SignJWT } from "jose";

const googleClient = new OAuth2Client();

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

function allowedOrigin(req) {
  const origin = req.headers.origin;
  const allowed = configured("ALLOWED_WEB_ORIGINS").split(",").map(x => x.trim()).filter(Boolean);
  return typeof origin === "string" && allowed.includes(origin);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return json(res, 405, { error: "METHOD_NOT_ALLOWED" });
  }

  try {
    if (!allowedOrigin(req)) return json(res, 403, { error: "ORIGIN_DENIED" });

    const clientId = configured("GOOGLE_OAUTH_CLIENT_ID");
    const sessionSecret = new TextEncoder().encode(configured("APP_SESSION_SIGNING_SECRET"));
    const allowedSubjects = new Set(
      configured("AUTHORIZED_GOOGLE_SUBJECTS").split(",").map(x => x.trim()).filter(Boolean)
    );
    const idToken = typeof req.body?.credential === "string" ? req.body.credential : "";
    if (!idToken || idToken.length > 12000) return json(res, 400, { error: "INVALID_CREDENTIAL" });

    const ticket = await googleClient.verifyIdToken({ idToken, audience: clientId });
    const payload = ticket.getPayload();
    if (!payload || !payload.sub || payload.iss !== "https://accounts.google.com" && payload.iss !== "accounts.google.com") {
      return json(res, 401, { error: "INVALID_GOOGLE_IDENTITY" });
    }
    if (payload.email_verified !== true) return json(res, 401, { error: "EMAIL_NOT_VERIFIED" });
    if (!allowedSubjects.has(payload.sub)) return json(res, 403, { error: "ACCOUNT_NOT_ENROLLED" });

    const now = Math.floor(Date.now() / 1000);
    const session = await new SignJWT({
      email: payload.email,
      email_verified: true,
      name: payload.name || "",
      purpose: "intal-app-session"
    })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setIssuer(configured("APP_SESSION_ISSUER"))
      .setAudience("intal-app")
      .setSubject(payload.sub)
      .setIssuedAt(now)
      .setNotBefore(now - 2)
      .setExpirationTime(now + 900)
      .setJti(crypto.randomUUID())
      .sign(sessionSecret);

    return json(res, 200, { sessionToken: session, tokenType: "Bearer", expiresIn: 900 });
  } catch (error) {
    const message = String(error?.message || "");
    if (message.startsWith("MISSING_CONFIG:")) return json(res, 503, { error: "AUTH_GATEWAY_NOT_CONFIGURED" });
    return json(res, 401, { error: "AUTHENTICATION_FAILED" });
  }
}
