# INTAL Workspace Identity UAT — Existing Apps Script Project Only

## Non-negotiable architecture decision

The INTAL WEB APP / Izin Tinggal Apps Script project is the only Apps Script project for this application.

- Do not create, clone, or migrate to a second Apps Script project.
- Do not replace the existing production deployment.
- A second deployment may be created from the same Apps Script project solely for controlled identity testing. A deployment is not a new Apps Script project and shares the same source and project-level Script Properties.
- The Kanwil spreadsheet remains a separate data store for isolated Kanwil staging. It is not an application runtime and does not imply a second Apps Script project.
- Never change `SPREADSHEET_ID` during this UAT. It continues to identify the canonical Izin Tinggal store.

## Why a same-project UAT deployment is needed

The current manifest uses `USER_DEPLOYING` and `ANYONE_ANONYMOUS`. This means the current production web app executes with the deployer's authority and its entry URL is not restricted to signed-in Workspace users.

Changing the active deployment directly could change Spreadsheet/Drive authorization behavior and interrupt production. UAT must therefore exercise `USER_ACCESSING` on a separate deployment from the same project, while the existing production deployment remains unchanged.

## Project-wide Script Properties constraint

Apps Script Script Properties are shared by deployments of the same project. They are not deployment-specific. Therefore:

- Do not switch canonical properties or identity enforcement flags to conduct UAT.
- Keep `INTAL_WORKSPACE_IDENTITY_ENFORCEMENT` unchanged for production until the release gate is approved.
- Use a dedicated property such as `INTAL_WORKSPACE_UAT_SPREADSHEET_ID` for the UAT-only test spreadsheet. Never put that value in `SPREADSHEET_ID`.
- Any UAT helper must read only the UAT-specific property and must never call canonical write/import/registry services.
- UAT helper endpoints must require an authenticated Workspace principal, an allowlisted domain, an active USERS mapping, and a dedicated admin permission. They must fail closed if any prerequisite is missing.
- Do not use a query parameter, client-supplied spreadsheet ID, or client-supplied role as an authorization or storage-selection mechanism.

## Controlled implementation sequence

### 1. Source and deployment inventory

Record and verify:

- Apps Script project ID (compare with the existing project; do not disclose it in public logs).
- Current production deployment ID, URL, manifest, and deployment workflow.
- Current Script Properties names and whether identity enforcement is enabled, without printing secret values.
- Existing `SPREADSHEET_ID` and the canonical storage readiness evidence.
- Existing Kanwil staging configuration, without exposing its spreadsheet ID in commits or CI logs.

No property or deployment setting is changed during this inventory.

### 2. Add a narrow UAT-only identity probe

Implement a minimal, protected UAT probe in the existing project. The probe must:

- Resolve identity only through `Session.getActiveUser().getEmail()`.
- Normalize the email and validate it against `INTAL_WORKSPACE_ALLOWED_DOMAINS`.
- Require exactly one active matching USERS row and the dedicated UAT permission.
- Open only `INTAL_WORKSPACE_UAT_SPREADSHEET_ID`.
- Return a minimal result: authenticated boolean, normalized principal (or masked principal in UI), role, allowed domain, UAT spreadsheet accessible boolean, and a correlation ID.
- Never return spreadsheet IDs, sheet contents, secrets, password hashes, or raw user rows.
- Perform no writes in the identity probe.
- Have a static contract proving that the probe has no call path to canonical import, dataset registry, Daily Input, Residence, Passport, Kanwil commit, or backup mutation functions.

Do not expose a generic spreadsheet-open RPC.

### 3. Prepare UAT storage

Create or designate a dedicated test spreadsheet for the Workspace UAT probe. It must contain no production or personal data.

Grant only the intended test identities the minimum access required for the specific test. Verify access using the UAT deployment, not by assuming that Editor access in the browser proves Apps Script runtime access.

The existing Kanwil staging spreadsheet is not automatically the Workspace identity test spreadsheet. Keep the purposes separate unless an explicit owner decision authorizes reuse.

### 4. Create a second deployment from the same project

Create a test deployment from the existing Apps Script project with `USER_ACCESSING` and the narrowest supported access setting for the intended Workspace audience.

Do not edit or replace the existing production deployment. Record the test deployment URL privately. Confirm the project ID is identical to production.

Because deployments share Script Properties, all UAT-specific configuration must use the dedicated UAT property and narrow helper described above.

### 5. Runtime test matrix

Test with at least:

- An authorized Workspace administrator.
- An authorized non-admin operator.
- A Workspace account from a non-allowlisted domain.
- A signed-in account with no USERS row.
- A disabled/revoked USERS account.
- An account with duplicate USERS mappings.
- A request with no active-user email.

Expected outcomes:

| Scenario | Expected |
|---|---|
| Allowlisted active admin with UAT permission | Identity accepted; UAT spreadsheet access tested |
| Allowlisted operator without UAT permission | Forbidden before spreadsheet access |
| Non-allowlisted domain | Unauthenticated |
| Missing USERS mapping | Unauthenticated |
| Disabled account | Unauthenticated |
| Duplicate USERS mappings | Unauthenticated |
| Empty active-user email | Unauthenticated |
| UAT spreadsheet not shared | Access denied; no fallback to canonical storage |
| Missing UAT spreadsheet property | Fail closed |
| Canonical spreadsheet ID accidentally supplied as UAT ID | Fail closed |

Also verify the current production URL and canonical data remain unchanged before, during, and after UAT.

### 6. Release gate

Do not activate Workspace enforcement in production until all of the following are recorded:

- Same Apps Script project identity confirmed.
- UAT deployment executes as the accessing user.
- All negative identity and permission tests pass.
- UAT spreadsheet ACL tests pass for each role.
- Static RPC call-graph tests pass.
- Protected runtime denial-before-side-effect tests pass.
- Authorized-path tests cover every high-risk mutation RPC.
- Production smoke tests pass against the unchanged production deployment.
- Rollback procedure and owner approval are recorded.

Record these statuses separately:

1. Implemented
2. CI passed
3. UAT passed
4. Deployed
5. Production certified

A green CI run is not proof of Workspace runtime identity, Drive/Spreadsheet ACL, deployment, or production certification.

## Explicitly out of scope

- Creating another Apps Script project.
- Changing the canonical Residence/Passport monthly datasets or registry.
- Changing the canonical `SPREADSHEET_ID`.
- Activating Daily Input or unblocking Gate 9.1.
- Enabling Kanwil commit or changing the Kanwil feature flag.
- Modifying the active production deployment or production Script Properties as part of UAT.
