# Multicarnes POS — Documentation

Technical documentation for the project. For overview, installation, and stack see the [main README](../README.md).

This is the entry point for **all project documentation** — start here.

## Index

| Document                                                 | Contents                                                                                              |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| [database.md](database.md)                               | Database schema, ER diagram (Mermaid), table-by-table reference, transactional flows, and migrations. |
| [../spec_pos_multicarnes.md](../spec_pos_multicarnes.md) | Full technical specification: modules, business rules, IPC surface, and shared types.                 |

## Conventions

- All documentation is written in **English**.
- Code references use markdown links pointing to the file (and line, when relevant): `[file.ts:42](../src/file.ts#L42)`.
- Diagrams use **Mermaid** so they render natively on GitHub.
- The canonical source of truth for runtime behavior is the code under [`src/`](../src/) — docs reflect the current state and should be updated alongside code changes.
