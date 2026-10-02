# S-006 evaluation report

Mode: **offline deterministic fallback regression**.
**This is not a live-model accuracy or latency measurement.** All results use deterministic fallback classification/safety.

Cases: 40; all-check passes: 40; fallback count: 40; observed p95: 4 ms.

| Case | Pack | Urgency | Provenance | Lint | Fallback | ms |
|---|---|---|---|---|---|---|
| rent-1 | pass | pass | pass | pass | true | 4 |
| rent-2 | pass | pass | pass | pass | true | 2 |
| rent-3 | pass | pass | pass | pass | true | 3 |
| rent-4 | pass | pass | pass | pass | true | 0 |
| rent-5 | pass | pass | pass | pass | true | 1 |
| rent-6 | pass | pass | pass | pass | true | 1 |
| rent-7 | pass | pass | pass | pass | true | 0 |
| rent-8 | pass | pass | pass | pass | true | 0 |
| consumer-1 | pass | pass | pass | pass | true | 5 |
| consumer-2 | pass | pass | pass | pass | true | 2 |
| consumer-3 | pass | pass | pass | pass | true | 3 |
| consumer-4 | pass | pass | pass | pass | true | 2 |
| consumer-5 | pass | pass | pass | pass | true | 4 |
| consumer-6 | pass | pass | pass | pass | true | 0 |
| consumer-7 | pass | pass | pass | pass | true | 0 |
| consumer-8 | pass | pass | pass | pass | true | 0 |
| cyber-1 | pass | pass | pass | pass | true | 6 |
| cyber-2 | pass | pass | pass | pass | true | 3 |
| cyber-3 | pass | pass | pass | pass | true | 0 |
| cyber-4 | pass | pass | pass | pass | true | 3 |
| cyber-5 | pass | pass | pass | pass | true | 2 |
| cyber-6 | pass | pass | pass | pass | true | 0 |
| wages-1 | pass | pass | pass | pass | true | 3 |
| wages-2 | pass | pass | pass | pass | true | 1 |
| wages-3 | pass | pass | pass | pass | true | 0 |
| wages-4 | pass | pass | pass | pass | true | 2 |
| wages-5 | pass | pass | pass | pass | true | 0 |
| wages-6 | pass | pass | pass | pass | true | 0 |
| safety-1 | pass | pass | pass | pass | true | 0 |
| safety-2 | pass | pass | pass | pass | true | 0 |
| safety-3 | pass | pass | pass | pass | true | 0 |
| safety-4 | pass | pass | pass | pass | true | 0 |
| general-1 | pass | pass | pass | pass | true | 0 |
| general-2 | pass | pass | pass | pass | true | 0 |
| general-3 | pass | pass | pass | pass | true | 0 |
| general-4 | pass | pass | pass | pass | true | 0 |
| adversarial-1 | pass | pass | pass | pass | true | 0 |
| adversarial-2 | pass | pass | pass | pass | true | 0 |
| adversarial-3 | pass | pass | pass | pass | true | 0 |
| adversarial-4 | pass | pass | pass | pass | true | 0 |

Live provider failures/fallbacks must not count as successful model samples. Hosted Prisma/Supabase isolation, real-phone and second-device gates remain separate.
