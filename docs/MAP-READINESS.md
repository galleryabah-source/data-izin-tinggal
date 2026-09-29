# Map Readiness v1

The residence-permit dataset contains 10 immigration offices consistently across the January-August 2026 operational rows:

1. KANIM KELAS I TPI BANDUNG
2. KANIM KELAS I TPI CIREBON
3. KANIM KELAS I NON TPI BOGOR
4. KANIM KELAS I NON TPI BEKASI
5. KANIM KELAS I NON TPI KARAWANG
6. KANIM KELAS I NON TPI DEPOK
7. KANIM KELAS I NON TPI TASIKMALAYA
8. KANIM KELAS II NON TPI SUKABUMI
9. KANIM KELAS III NON TPI CIANJUR
10. KANIM KELAS II NON TPI GARUT

## Office Reference Contract v1

The map layer must not infer coordinates from office names. Each reference row must contain:

- `office_key`
- `kantor_imigrasi`
- `address`
- `latitude`
- `longitude`
- `source_url`
- `verified_at`
- `status`

A row is map-ready only when:

- address is non-empty;
- latitude is numeric and between -90 and 90;
- longitude is numeric and between -180 and 180;
- source_url is present;
- status is exactly `VERIFIED`.

## Readiness gate

`getOfficeReferenceStatus()` compares the reference table against the offices actually present in `DATA_RESIDENCE_PERMIT_SERVICE_MONTHLY`.

Map UI must remain blocked until:

- all expected offices have reference rows;
- no reference row is invalid;
- all rows are marked `VERIFIED`.

This keeps geographic metadata independent from the service dataset and prevents an unverified coordinate from silently becoming production map data.
