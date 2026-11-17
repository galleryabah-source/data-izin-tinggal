# Kanwil Analytics & Privacy Contract

Status: implementation contract / not production certification.

## 1. Data boundary

Kanwil source records contain 17 fields, including personal data. Operational analytics must count records and group them by service and operational dimensions. The public INTAL TV presentation is aggregate-only.

The following fields are prohibited from TV payloads, HTML, browser storage, map labels, running text, and client-side analytics:
- `nama`
- `tanggal_lahir`
- `no_passport`
- `nomor_permohonan`
- `penjamin`

No row-level Kanwil application data may be sent to public TV endpoints. The TV receives only aggregate labels and counts.

## 2. INTAL TV aggregate dimensions

- Total permohonan.
- Jumlah per layanan.
- Jumlah per kategori produk.
- Jumlah per jenis produk.
- Jumlah per kebangsaan.
- Jumlah per tujuan.
- Jumlah per status permohonan.

TV must not show names, dates of birth, passport numbers, application numbers, guarantor names, or row-level detail. Any drilldown from TV remains aggregate-only.

## 3. Back-office / workspace analytics

The authenticated back-office workspace may provide:
- Total records and totals by selected period.
- Service, product category, product type, nationality, purpose, position, and status distributions.
- Daily/monthly trend by operational date, based on an owner-approved date basis.
- Filter by date range, service, nationality, product, purpose, status and office/scope when the scope is reliably identified.
- Cross-tabulations (service × nationality, service × status, product × purpose).
- Data-quality summaries: missing required fields, invalid dates, duplicate application-number candidates, unmapped categories, and review/rejection counts.
- Row-level detail only for specifically authorized back-office roles, with least-privilege permissions and audit. Row-level detail must not be reused by TV.

## 4. Privacy and statistical safeguards

- Public TV projection is a strict allowlist projection; never serialize or spread raw records.
- Small-cell suppression must be configurable before public release where counts could identify an individual. Default proposed threshold: suppress counts below 3; owner/privacy officer approval required before activation.
- Unknown or blank dimension values are grouped as `TIDAK DIKETAHUI`, not silently dropped.
- Aggregation is computed from committed/approved records only; pending, rejected, and review-only screenshot rows are excluded.
- Record count means application records, not unique people, unless an approved identity-resolution rule exists.
- Nationality values should be normalized through a controlled reference dictionary; source text remains preserved for audit.
- Date grouping must declare the chosen event date. Do not infer one date field from another.
- TV response contains no source identifiers, raw data, PII, row IDs, or internal storage references.

## 5. Release boundary

The pure aggregate contract is implemented in `gas/KanwilAnalyticsContract.js`. It does not read staging storage, expose an RPC, or activate TV output. Storage, approved-record lifecycle, authenticated back-office analytics endpoints, public TV endpoint, UI charts, and suppression policy remain gated on security and staging readiness. Screenshot/OCR stays browser-local review-only.
