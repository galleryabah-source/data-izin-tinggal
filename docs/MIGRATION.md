# Dasmon Imigrasi — Migration & Provenance Plan

Current Data Izin Tinggal production remains authoritative during migration.

## Pipeline
Source snapshot → hash/manifest → extract → normalize → contract validation → staging PostgreSQL → integrity checks → canonical promotion → parity report.

## Required parity
- structural: columns, types, required fields, business key, version
- row-level: row count, duplicate keys, blank keys, measure validity, derived total
- aggregate: grand total, monthly totals, office totals, service totals
- operational: latest import, audit event, snapshot identity, migration ID

## Initial baseline
Residence: 80 rows, 8 periods, 10 offices, total 258,094.
Passport: 80 rows, 8 periods, 10 offices, total 327,088.

These are migration evidence for the current certified baseline, not permanent hard-coded limits.

## Cutover
V2 cannot become the sole production source until parity evidence is complete and reproducible.
