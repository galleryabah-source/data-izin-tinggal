# INTAL Pro — Architecture and Boundary Specification

## 1. System boundary

### Legacy Production

- Apps Script runtime.
- Google Sheets storage.
- Current production UI and INTAL TV.
- Existing certified datasets.
- Existing operational evidence.

### INTAL Pro

- Next.js web application.
- PostgreSQL canonical storage.
- Typed application/service layer.
- Modern authentication/authorization.
- Independent CI/CD.
- Independent environments.

The systems may coexist during migration.

## 2. Boundary rule

No INTAL Pro production component may write to Legacy Production datasets.

If Legacy data is required by V2, it must cross an explicit adapter:

Legacy Source -> Extraction -> Evidence -> V2 Staging -> Canonical Promotion

No hidden direct spreadsheet writes.

## 3. Data layers

### Source
Google Sheets, uploaded XLSX/CSV, or future approved source systems.

### Staging
Temporary, quarantined, traceable data associated with an import batch.

### Canonical
Validated PostgreSQL records conforming to a versioned dataset contract.

### Semantic
Read-only reporting views/services that derive KPIs from canonical data.

### Presentation
Web UI, GIS, exports, and TV/display clients.

## 4. Write path

All canonical writes must follow:

request
-> authenticate
-> authorize
-> identify dataset contract
-> validate schema
-> validate business key
-> validate measures
-> validate derived fields
-> transaction
-> commit
-> audit
-> evidence

## 5. Read path

All application reads must follow:

UI
-> typed service/API
-> authorization
-> canonical query/reporting view
-> DTO
-> UI

No component should construct ad-hoc business calculations independently if the calculation is a canonical domain metric.

## 6. Identity

Every import receives an immutable batch ID.

Recommended provenance chain:

source_file_hash
-> import_batch_id
-> dataset_version
-> canonical commit/transaction
-> audit_event_id
-> report/query execution
-> deployment/runtime evidence

## 7. Database integrity

At minimum:

- UNIQUE(period, office) for each monthly dataset.
- CHECK constraints for non-negative integer measures.
- NOT NULL constraints for required contract fields.
- Foreign keys for office/reference identity.
- Explicit contract version.
- Indexed period and office filters.
- Transactional import commit.

## 8. GIS

Office coordinates belong to a governed office reference entity.

A service dataset references an office by canonical office identity/name according to the contract. GIS must never silently invent coordinates.

Reference states:

PENDING -> VERIFIED -> RETIRED

Only VERIFIED references may be used by production GIS.

## 9. Security

Authentication identifies the actor.

Authorization determines whether the actor may perform an action.

Database policy provides defense in depth.

Suggested roles:

ADMIN
SUPERVISOR
OPERATOR
VIEWER
AUDITOR

The permission vocabulary may preserve the existing semantics while becoming database-backed.

## 10. Observability

Every production deployment should expose enough evidence to establish:

- released commit;
- build artifact;
- deployment ID;
- runtime version;
- database migration version;
- application version;
- environment;
- health status.

## 11. Performance target direction

Initial targets should be validated with real staging measurements, not assumed as guarantees.

Recommended engineering objectives:
- cached dashboard read: sub-second target;
- common filtered API read: low single-digit seconds maximum under expected load;
- GIS initial data response: bounded and paginated/aggregated;
- import: asynchronous for large files;
- frontend: no blocking dependency on multiple sequential backend calls.

The exact SLOs must be established after baseline measurement.

## 12. Failure strategy

- Import failure: no partial canonical commit.
- Validation failure: quarantine/reject batch.
- Reference failure: fail closed for GIS.
- Authorization failure: deny and audit.
- Database migration failure: stop deployment.
- Application deployment failure: rollback to previous verified artifact.
