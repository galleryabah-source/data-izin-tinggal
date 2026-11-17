# P1 — Google Workspace Identity Contract for INTAL

**Date:** 2026-11-17  
**Decision:** Google Workspace is the approved organizational Identity Provider for INTAL.  
**Status:** Architecture and implementation contract; not runtime implementation, deployment approval, or production certification.

## 1. Confirmed decision and scope

The system owner has approved Google Workspace as INTAL's official identity provider.

The initial P1 implementation will use the authenticated Google Workspace session provided by the Apps Script web-app runtime. It will not introduce a custom JWT issuer, OAuth proxy, third-party identity broker, or browser-managed bearer token unless a later architecture decision demonstrates that native Workspace session identity is insufficient.

Authentication and authorization remain separate:
- Workspace establishes the Google account identity.
- INTAL resolves that identity to an active internal user record.
- INTAL resolves current roles, permissions, and resource scope server-side.
- No client-supplied email, role, permission, or user ID is authoritative.

## 2. Required deployment mode

Protected INTAL web-app routes and RPC calls require the Apps Script deployment to execute as **the user accessing the web app**, with access restricted to the approved Google Workspace organization/domain.

Before enabling this mode, verify in the actual Apps Script deployment:
1. Execute-as setting is User accessing the web app.
2. Access setting is restricted to the approved Workspace organization/domain.
3. Every intended user is in the approved Workspace tenant and can authorize the application.
4. The active-user email is present in the actual deployed execution context.
5. The app's spreadsheet and Drive access model works under the accessing user's effective permissions, or a separately reviewed least-privilege storage model is approved.

If the application currently executes as the deployer, do not silently switch the production deployment. That changes data-access semantics and may affect spreadsheet/Drive permissions. Verify it in a non-production deployment first, document the impact, and obtain release approval.

## 3. Server-side identity contract

The server must derive identity only from the Apps Script execution context:
- Read Session.getActiveUser().getEmail().
- Normalize whitespace and case.
- Reject an empty identity with UNAUTHENTICATED.
- Validate the email domain against a server-controlled Workspace domain allowlist.
- Resolve exactly one ACTIVE USERS record.
- Reject missing, duplicate, inactive, or ambiguous account mappings.
- Use the internal user_id UUID as the durable INTAL principal identifier.
- Treat email as a mutable Workspace login attribute, not as an immutable subject identifier.
- Email changes require a privileged, audited account-maintenance operation; never auto-create or auto-link an account from a client payload.

The current getCurrentIdentity_() already reads Session.getActiveUser().getEmail(). P1 must harden the missing-email, domain, duplicate-account, inactive-account and account-mapping cases without adding a permissive fallback.

## 4. Prohibited identity fallbacks

The following are never acceptable for protected RPC authentication:
- Session.getEffectiveUser().getEmail() as a fallback for the accessing user;
- email, role, permissions, or user ID supplied by browser payload;
- a client-side route guard or hidden UI control;
- automatic creation of an INTAL user when an unknown Workspace account arrives;
- a fallback to legacy identity when a future verifier fails;
- a shared deployer identity treated as the requesting user.

Session.getEffectiveUser() may be used only for explicitly documented deployment-owner diagnostics, never to authenticate an end user.

The editor-only bootstrap helper must remain private and must not become a browser-callable RPC. Initial administrator provisioning must be a controlled, one-time operational procedure with audit evidence and no public bootstrap route.

## 5. Authorization contract

After authentication, every protected endpoint must:
1. Resolve the active INTAL user from the server-side Workspace identity.
2. Resolve current permissions from the authoritative PERMISSIONS table.
3. Check the exact capability declared in RPC_MANIFEST_V1.
4. Check resource scope independently (office, dataset, period, or Kanwil scope).
5. Re-check authorization immediately before privileged mutations.
6. Return normalized UNAUTHENTICATED or FORBIDDEN errors without disclosing account existence or sensitive identity details.

RPC_MANIFEST_V1 remains an inventory/test contract until runtime enforcement is separately implemented and tested. It must not be represented as an authorization engine by itself.

## 6. Domain and tenant policy

- Approved Workspace domain(s) must be configured by an administrator in a server-controlled deployment setting.
- Do not infer the domain from the first user who signs in.
- Do not place domain allowlists in browser code.
- Consumer Gmail accounts and external tenants are denied unless explicitly approved through a separate owner decision and policy review.
- Avoid logging full email addresses in general telemetry. Audit records may use the internal user UUID; restricted security diagnostics may retain the minimum identity needed for investigation.

## 7. Data access and deployment implications

The User accessing the web app execution mode means spreadsheet and Drive operations run under the accessing user's authority. This may require explicit sharing of the backing spreadsheet and Drive folders with users or groups. It may also expose permission differences between users.

Before production rollout:
- inventory all SpreadsheetApp, DriveApp, UrlFetchApp and other privileged service calls;
- identify required file/folder ACLs and scopes;
- test least-privilege users and users without direct spreadsheet access;
- verify backup, export, import, snapshot and restore behavior;
- verify quotas and runtime limits under multiple users;
- ensure no service relies on the deployer's broader Drive access;
- define a controlled storage service identity only if Workspace-native execution cannot satisfy the operational requirements, and review that design separately.

Do not grant broad Drive or spreadsheet access merely to make tests pass.

## 8. P1 pilot and required tests

Select one read-only protected RPC with a representative browser callsite. Migrate the complete request path and test:

| Scenario | Expected result |
|---|---|
| No active Workspace identity | UNAUTHENTICATED |
| Empty active-user email | UNAUTHENTICATED |
| External/unapproved domain | UNAUTHENTICATED |
| Unknown Workspace account | UNAUTHENTICATED |
| Duplicate internal account mapping | UNAUTHENTICATED and security alert |
| Inactive INTAL account | UNAUTHENTICATED |
| Active user without required permission | FORBIDDEN |
| Permission revoked after page load | FORBIDDEN on next RPC |
| Valid user with wrong office/dataset scope | FORBIDDEN |
| Client spoofs email, role, permission or user ID | Spoofed values ignored; server identity used |
| Direct call to protected RPC | Same server-side checks as normal UI path |
| Public TV allowlisted read | Only approved sanitized projection |
| Public TV call to protected mutation | Denied |

The pilot must include browser integration, server execution-context verification, deterministic unit tests, negative tests, audit evidence and rollback behavior.

## 9. Release gates

P1 may progress from design to implementation only after:
- actual deployment execution/access settings are inspected;
- approved Workspace domain(s) are confirmed and configured;
- storage/Drive permission implications are documented;
- one pilot RPC and browser callsite are selected;
- test accounts cover admin, supervisor, operator, viewer, inactive, external and unauthorized cases.

No production deployment, bulk permission change, spreadsheet sharing change, or migration of all RPCs is authorized by this document.

## 10. Explicitly unchanged

- Canonical monthly Residence and Passport datasets, registry identity, importer and historical baselines.
- Daily Input code guard remains disabled; Gate 9.1 remains BLOCKED.
- Kanwil Smart Screenshot Entry remains draft/review-only.
- Public TV remains an anonymous finite allowlist pending data-owner publication approval.
- No production deployment or UAT certification is claimed.


## 11. Repository deployment baseline — verified 2026-11-17

The source-controlled Apps Script manifest at `gas/appsscript.json` currently declares:

```json
{
  "webapp": {
    "executeAs": "USER_DEPLOYING",
    "access": "ANYONE_ANONYMOUS"
  }
}
```

The production deploy workflow is `.github/workflows/deploy-gas.yml`:
- deploy runs only on a push to `main`;
- it uses the GitHub Actions `production` environment;
- clasp credentials and Apps Script ID are read from GitHub Secrets;
- it pushes source, creates an immutable version and updates the pinned deployment ID;
- pull-request runs validate only; the deploy job is skipped.

This confirms the checked-in source manifest is currently configured to execute as the deployer and permit anonymous access. It does not independently prove the live Apps Script deployment settings have not drifted; the Apps Script deployment configuration must still be inspected directly by an authorized project administrator.

### Mandatory migration safety decision

Do not change the production manifest directly from `USER_DEPLOYING / ANYONE_ANONYMOUS` to `USER_ACCESSING / DOMAIN` in the same release as the first identity guard.

That change affects both the authentication boundary and the effective principal for Spreadsheet/Drive operations. Existing code uses Script Properties to open the canonical spreadsheet and other Google services; those calls may behave differently or fail when executed as each user.

Required sequence:
1. Preserve the current production deployment and manifest unchanged.
2. Create a separate non-production Apps Script deployment/project with an isolated test spreadsheet and isolated Drive folder; never point it at the canonical production spreadsheet.
3. Configure that non-production deployment as `USER_ACCESSING` and restrict access to the approved Workspace domain.
4. Test active-user email visibility, user consent/scopes, spreadsheet access, Drive access, quotas and all required service operations using least-privilege Workspace test accounts.
5. Implement the identity guard behind an explicit server-side feature flag that defaults OFF. When ON, missing identity, missing domain allowlist, domain mismatch, missing or duplicate active USERS mapping must fail closed. There is no `getEffectiveUser()` or client-payload fallback.
6. Test the guard and protected RPCs in the isolated deployment, including negative tests and rollback.
7. Only after owner-approved UAT and a reviewed storage-access model may a separate production migration PR alter the manifest and release workflow.

The repository does not contain live Apps Script deployment settings, Google Workspace domain configuration, spreadsheet ACLs, Drive ACLs, or GitHub secret values. Those cannot be verified from source code and must not be inferred from the manifest or workflow alone.
