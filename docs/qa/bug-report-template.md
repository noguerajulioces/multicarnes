# Bug report template

> Copy this template into the issue tracker (or a new file under `docs/qa/bugs/`) and fill every section. Empty sections delay triage.

## Summary

One sentence — what is broken, in user terms.

## Environment

| Field          | Value                              |
| -------------- | ---------------------------------- |
| App version    | e.g. 1.1.0                         |
| OS             | Windows 11 / macOS 14.4 / Ubuntu…  |
| Build source   | release installer / dev build      |
| User role      | admin / cashier / …                |
| Printer model  | (if relevant)                      |
| Database state | fresh / migrated / restored backup |

## Severity

- [ ] Critical — data loss, cannot bill, app crashes on launch.
- [ ] Major — core flow broken, workaround exists.
- [ ] Minor — cosmetic, copy, layout.

## Steps to reproduce

1.
2.
3.

> Start from a known state (e.g. "fresh install with seed data, logged in as admin, cash open").

## Expected result

What should happen.

## Actual result

What actually happens. Include exact error text.

## Evidence

- [ ] Screenshot
- [ ] Screen recording
- [ ] Console / DevTools log (`View → Toggle Developer Tools → Console`)
- [ ] DB file copy (only if non-sensitive test data)

## Reproducibility

- [ ] Always (100%)
- [ ] Often (>50%)
- [ ] Sometimes (<50%)
- [ ] Once

## Related test case

ID from `docs/qa/test-cases/` if this bug was found while running one (e.g. `SAL-004`).

## Notes

Anything else: workarounds tried, suspected component, recent changes, etc.
