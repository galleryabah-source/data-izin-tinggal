# Phase 9 — Operational Source Audit Worksheet v1

**Status:** evidence collection template — Gate 9.1 not yet passed  
**Purpose:** capture the real daily operational workflow before any daily dataset contract or production implementation is approved.

## 1. Required evidence

Gate 9.1 requires at least one real representative operational source, such as:

- daily spreadsheet/export;
- operational application report;
- database extract;
- official SOP/workflow;
- representative sample covering normal and correction cases.

A description alone is insufficient to approve the production daily contract.

## 2. Source identification

| Item | Evidence / answer |
|---|---|
| Service family | |
| Source system / workbook | |
| Source owner | |
| Operational users | |
| Reporting period | |
| Timezone | Asia/Jakarta |
| Source format | |
| Refresh frequency | |
| One record represents | |
| Current source business key | |
| Source of truth | |
| Retention requirement | |

## 3. Grain audit

Determine exactly what one operational record means.

Questions:

1. Is one record one **date × office**?
2. Can one office have multiple records on the same date?
3. Can the same operational event be corrected later?
4. Is there a transaction/event identifier?
5. Are service categories fixed or variable?
6. Can a source row represent a subtotal rather than an observation?
7. Is the source already aggregated before export?

Required conclusion:

```
one record = ______________________________
```

Candidate daily business identities must not be approved until these answers are evidenced.

## 4. Field audit

For every source column:

| Source column | Meaning | Type | Required | Canonical candidate | Derived? | Evidence |
|---|---|---|---:|---|---:|---|
| | | | | | | |

Explicitly classify:

- identifiers;
- operational date/time;
- immigration office;
- service measures;
- supplied total;
- status;
- correction/revision markers;
- source metadata;
- presentation-only fields.

## 5. Correction audit

Document real correction scenarios:

| Scenario | Current source behavior | Desired canonical behavior | Authorization | Audit required |
|---|---|---|---|---|
| Wrong count | | | | |
| Wrong office | | | | |
| Late entry | | | | |
| Duplicate entry | | | | |
| Post-close correction | | | | |
| Source withdrawal/void | | | | |

Required answer:

**Does the operational source support immutable revision history, or must the application introduce it?**

## 6. Period-close audit

Document how operations actually decide that a period is final.

| Question | Evidence / answer |
|---|---|
| What is the closing period? | |
| Who reviews it? | |
| Who approves it? | |
| What proves review completion? | |
| Can closed data be edited? | |
| Who can reopen it? | |
| What is the reason code for reopening? | |
| Is there a deadline? | |
| Is close based on calendar date or explicit action? | |

The application must not infer closure solely from elapsed time.

## 7. Aggregate audit

Confirm how daily values should map to monthly/yearly reporting.

### Monthly

```
approved latest revision
        ↓
YYYY-MM(tanggal)
        ↓
kantor_imigrasi
        ↓
SUM(service measures)
```

### Yearly

```
approved latest revision
        ↓
YYYY(tanggal)
        ↓
kantor_imigrasi
        ↓
SUM(service measures)
```

Evidence must establish whether there are exceptions such as:

- retroactive transactions;
- cancelled services;
- transfers between offices;
- reopened periods;
- non-operational calendar dates;
- duplicate source submissions.

## 8. Historical baseline reconciliation

If the daily source covers January–August 2026, it must first be compared with the verified monthly baselines.

Required reconciliation dimensions:

- month;
- office;
- service measure;
- total;
- row count;
- missing office;
- unexpected office;
- unresolved correction.

No reconciliation may mutate:

- `DATA_RESIDENCE_PERMIT_SERVICE_MONTHLY`
- `DATA_PASSPORT_SERVICE_MONTHLY`

## 9. Minimum contract approval criteria

Gate 9.1 may be marked **PASS** only when all are known:

- [ ] real source identified;
- [ ] source owner identified;
- [ ] grain proven;
- [ ] business identity proven;
- [ ] required measures proven;
- [ ] correction behavior documented;
- [ ] period-close behavior documented;
- [ ] approval authority documented;
- [ ] representative normal sample available;
- [ ] representative correction sample available;
- [ ] historical overlap identified;
- [ ] timezone confirmed.

Until all are satisfied, no daily production contract should be created.

## 10. Evidence package

When the source becomes available, attach or reference:

1. source sample;
2. source schema/header;
3. operational workflow/SOP;
4. normal-case example;
5. correction example;
6. close/reopen example;
7. reconciliation sample if historical overlap exists.

The evidence package becomes the input to **Gate 9.2 — Contract Approval**.

## 11. Current finding

Repository audit on 2026-09-30 found no existing daily operational source, SOP, sample, or field definition sufficient to approve a daily production contract.

Therefore:

**Gate 9.1 = NOT PASSED.**

This is an intentional stop condition, not an implementation failure.

The existing monthly production datasets remain unchanged and authoritative.
