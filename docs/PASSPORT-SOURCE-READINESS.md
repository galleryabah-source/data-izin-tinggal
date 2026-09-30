# Passport Service — Source Readiness

**Status:** discovery / design preparation only  
**Dataset target:** `PASSPORT_SERVICE_MONTHLY`  
**Production status:** not implemented

## Purpose

Prepare the Passport service contract without guessing its schema. The existing Residence Permit contract remains unchanged and is the canonical production baseline.

## Evidence from official immigration sources

Official immigration publications show that passport reporting can contain dimensions that are not present in the Residence Permit dataset.

Examples include:

- passport type;
- ordinary versus electronic passport;
- new issuance;
- replacement because of expiry;
- replacement because of damage;
- replacement because of loss;
- other replacement reasons;
- immigration office;
- reporting period.

A 2026 official immigration report for Jakarta Pusat presents passport issuance grouped by passport type and issuance/replacement reason. A 2026 official Batam report separately reports new versus replacement electronic passports.

These observations are **source evidence only**, not a finalized contract.

## Contract decision rule

Do not copy the Residence Permit columns into Passport.

The Passport contract must be derived from an actual source fixture supplied or approved for this application.

Required evidence before Contract v1:

1. actual Passport workbook/table;
2. source sheet structure;
3. reporting period/grain;
4. office dimension;
5. passport-type dimension;
6. service/reason dimension;
7. subtotal/total semantics;
8. duplicate/business-key semantics;
9. any source columns that are unstable or presentation-only.

## Candidate analytical grain

The initial candidate is:

`periode × kantor_imigrasi × jenis_paspor × jenis_layanan`

This is deliberately provisional.

The final grain may be different if the real source demonstrates a better normalized structure.

## Candidate dimensions observed in public official sources

Potential dimensions to evaluate against the real source:

- `periode`
- `kantor_imigrasi`
- `jenis_paspor`
- `jenis_permohonan`
- `alasan_penggantian`
- `total`

No field is approved for Contract v1 solely from this document.

## Validation requirements

The eventual Passport contract must define:

- required and optional columns;
- normalized data types;
- non-negative count rules;
- derived total rules;
- subtotal exclusion rules;
- business key;
- duplicate handling;
- existing-dataset duplicate handling;
- correction/revision semantics;
- export semantics;
- audit requirements;
- backup/snapshot requirements;
- production smoke baseline.

## Fixture requirement

The next implementation artifact should be a real normalized Passport fixture, for example:

`PASSPORT_SERVICE_MONTHLY_v1.xlsx`

It must be generated from an approved real source, not invented sample data.

## Non-goals

This document does not:

- modify the Residence Permit dataset;
- add Passport production code;
- register a Passport dataset;
- alter the dashboard;
- alter production permissions;
- authorize a Passport deployment.

## Next gate

`Real Passport source -> source analysis -> normalized fixture -> Contract v1 -> validator/importer -> test -> production deployment`

Until the real source is available, implementation should stop at source-readiness/design preparation.
