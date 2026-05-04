# Test cases — index

Each file groups detailed cases for one module. Run the relevant files based on what changed in the release; for a full regression, run them all.

| Prefix | Module          | File                                       |
| ------ | --------------- | ------------------------------------------ |
| LOG    | Login & session | [login.md](login.md)                       |
| SAL    | Sales           | [sales.md](sales.md)                       |
| CSH    | Cash session    | [cash.md](cash.md)                         |
| PRD    | Products        | [products.md](products.md)                 |
| CUS    | Customers       | [customers.md](customers.md)               |
| PUR    | Purchases       | [purchases.md](purchases.md)               |
| USR    | Users & roles   | [users.md](users.md)                       |
| RPT    | Reports         | [reports.md](reports.md)                   |
| BAK    | Backup          | [backup.md](backup.md)                     |
| CFG    | Configuration   | [configuration.md](configuration.md)       |

## How to run a module

1. Set up the preconditions stated at the top of each case.
2. Run steps in order.
3. Mark **Pass / Fail / Blocked** with a one-line note.
4. For each Fail, file a bug using [../bug-report-template.md](../bug-report-template.md) and link the bug ID.

## Adding new cases

- Use the next free number in the module prefix (e.g. after `SAL-018` use `SAL-019`).
- Keep the same fields: Preconditions, Steps, Expected.
- Tag priority: **P1** blocker, **P2** major, **P3** minor.
- If a case crosses modules, place it in the module that owns the action and reference the others by ID.
