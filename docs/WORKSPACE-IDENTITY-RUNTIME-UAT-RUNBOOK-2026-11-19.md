# Workspace Identity Runtime UAT Runbook — INTAL

**Date:** 2026-11-19  
**Status:** EXECUTION PROCEDURE — NOT EVIDENCE OF EXECUTION OR GATE PASS  
**Applies to:** Workspace Identity Guard and RPC authorization  
**Production safety:** Keep `INTAL_WORKSPACE_IDENTITY_ENFORCEMENT` unchanged in the production Apps Script project. Do not edit the canonical deployment, production Script Properties, canonical spreadsheet ACLs, or production users while executing this runbook.

## 1. Critical isolation requirement

Apps Script Script Properties belong to the Apps Script project, not to an individual web-app deployment. A second deployment ID in the same project is therefore **not** an isolated configuration boundary.

The runtime test must use a separate Apps Script project (staging clone) with:
- source copied from the exact reviewed commit;
- its own Script Properties;
- a dedicated staging spreadsheet and staging USERS/PERMISSIONS data;
- a separate web-app deployment ID and URL;
- access limited to the designated Workspace test group;
- no production OAuth credentials, production spreadsheet IDs, or production Script Properties.

Never set `INTAL_WORKSPACE_IDENTITY_ENFORCEMENT=true` in the production project merely to test a second deployment. That property would affect every deployment of that project.

## 2. Deployment modes to evaluate

The current production manifest is `USER_DEPLOYING / ANYONE_ANONYMOUS`. Keep it unchanged during this runbook.

Test the following modes only in the isolated staging project:

1. **Owner-executed, domain-restricted:** `USER_DEPLOYING` with access restricted to the Workspace domain. Verify whether `Session.getActiveUser().getEmail()` is consistently available for domain users and blank/denied for external identities.
2. **Accessing-user execution (diagnostic only):** `USER_ACCESSING` with access restricted to the Workspace domain. Verify identity availability, OAuth consent, and the effective user's actual Drive/Spreadsheet permissions. Do not assume this mode is suitable for production: each caller may need direct access to the backing spreadsheet, which can conflict with application-level RBAC and least privilege.
3. **Anonymous public TV:** verify the intended public read-only views separately. Confirm public routes return only the allowlisted aggregate/map/service-point projections and protected RPCs remain denied to anonymous callers.

Google documents that `User.getEmail()` can be blank in some execution contexts, including web apps running as the developer, but that this restriction generally does not apply when developer and user belong to the same Workspace domain. This is a runtime property to verify, not an assumption. See:
- https://developers.google.com/apps-script/reference/base/user
- https://developers.google.com/apps-script/guides/web
- https://developers.google.com/apps-script/manifest/web-app-api-executable

## 3. Staging configuration

Configure only in the isolated staging Apps Script project:

- `SPREADSHEET_ID`: staging application database spreadsheet.
- `INTAL_WORKSPACE_IDENTITY_ENFORCEMENT`: `true`.
- `INTAL_WORKSPACE_ALLOWED_DOMAINS`: exact approved Workspace domain list, separated by commas, semicolons, or whitespace.
- `DAILY_INPUT_GUARD_V1.enabled`: remain `false`.
- `DAILY_STAGING_SPREADSHEET_ID`: omit unless Daily Input staging is separately authorized and under test.

The staging spreadsheet must not be the canonical production spreadsheet. Populate only synthetic test identities and minimal permission fixtures. Never copy production password hashes, private user details, or sensitive records into test fixtures.

## 4. Runtime identity and authorization matrix

Use dedicated test accounts. Record account role labels, not passwords or access tokens.

| ID | Test identity / condition | Expected result |
|---|---|---|
| WI-01 | Active user in allowed Workspace domain, exactly one ACTIVE USERS mapping | Identity resolves to normalized email; assigned permission is evaluated |
| WI-02 | Uppercase or padded email returned by identity context | Normalized lowercase, trimmed email |
| WI-03 | User outside allowed domain | `UNAUTHENTICATED` |
| WI-04 | Active-user email unavailable/blank | `UNAUTHENTICATED`; no USERS lookup may authenticate a blank-email row |
| WI-05 | Allowed domain list missing or empty | `WORKSPACE_DOMAIN_POLICY_MISSING` |
| WI-06 | Email has no valid domain component | `UNAUTHENTICATED` |
| WI-07 | Two USERS rows map to the same email, including one inactive row | `UNAUTHENTICATED`; duplicate identity mapping fails closed |
| WI-08 | No USERS row for an otherwise valid Workspace email | `UNAUTHENTICATED` |
| WI-09 | One matching but INACTIVE USERS row | `UNAUTHENTICATED` |
| WI-10 | Active VIEWER with `dashboard.read` calls dashboard read | Allowed |
| WI-11 | Active VIEWER calls `admin.config` endpoint | `FORBIDDEN`; no mutation or read side effect |
| WI-12 | Permission is removed in PERMISSIONS after prior successful call | Next protected call denied; no stale role grant |
| WI-13 | Caller supplies another user's email/user ID in RPC arguments | No identity substitution or privilege elevation |
| WI-14 | Anonymous caller invokes a protected RPC directly through `google.script.run` | Denied server-side |
| WI-15 | Anonymous caller invokes an allowlisted Public TV endpoint | Only declared public projection returned |
| WI-16 | Anonymous caller invokes a write/admin RPC | Denied; no row, audit, configuration, or registry change |

For each negative test, verify both the denial response and absence of state changes. Hiding a UI control is not a security test.

## 5. Storage and least-privilege checks

Run the checks in both owner-executed and accessing-user diagnostic modes:

- Verify which principal actually opens the staging spreadsheet.
- Verify the actual permission required for read-only and mutation operations.
- Confirm a user without direct spreadsheet access cannot access it in `USER_ACCESSING` mode.
- Confirm the owner-executed mode does not leak a direct spreadsheet URL, raw sheet rows, or privileged service output to the browser.
- Confirm all authorization checks happen server-side before database reads or writes.
- Confirm role permissions are sourced from the server-side PERMISSIONS table, not from browser state or caller-supplied claims.
- Confirm no test account receives broad Drive access merely to make a test pass.
- Confirm no production file, spreadsheet, or folder is added to the staging test accounts.

A successful `USER_ACCESSING` test is not automatically a reason to switch production to that mode. The decision must account for the application's shared database design, required Sheets scopes, direct spreadsheet ACL exposure, and operational usability.

## 6. Evidence requirements

For every WI test capture:
- exact commit SHA and staging project/deployment identifier (do not publish secrets);
- deployment mode and access audience;
- test case ID and synthetic account role;
- server-observed identity result (redacted to role/expected outcome where possible);
- RPC name and expected permission;
- normalized outcome (`ALLOW`, `UNAUTHENTICATED`, or `FORBIDDEN`);
- evidence that no state changed for denied calls;
- timestamp in Asia/Jakarta and correlation/test ID.

Do not log raw tokens, passwords, OAuth grants, private email addresses, full spreadsheet IDs, or sensitive sheet contents in CI or PR comments.

## 7. Release decision

Workspace identity runtime gate remains **BLOCKED** until:
- all WI-01 through WI-16 tests pass in the isolated staging project;
- identity visibility is proven for the intended production execution mode;
- duplicate and inactive identity mappings fail closed;
- the backing spreadsheet access model is approved for least privilege;
- public TV remains anonymous and read-only without granting public access to protected RPCs;
- an independent reviewer checks the exact tested commit and evidence;
- production Script Properties and canonical deployment settings are verified unchanged.

Do not change production execution mode, public access mode, Workspace enforcement flag, Drive/Spreadsheet ACLs, or Daily Input gates as part of this runbook. A CI pass or a staging runbook is not production certification.
