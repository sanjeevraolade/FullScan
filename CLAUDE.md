# FullScan Monorepo

Two projects that ship together:

| Folder            | What it is                                                                                          | Rules                                                  |
| ----------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `FullScanApp/`    | React Native field-verification app used by Field Executives (offline-first, screen-based)          | [FullScanApp/CLAUDE.md](FullScanApp/CLAUDE.md)         |
| `FullScanServer/` | Node/Express + MongoDB backend the app talks to, plus the admin and FE web portals                  | [FullScanServer/CLAUDE.md](FullScanServer/CLAUDE.md)   |
| `docs/`           | Cross-project feature docs and API contracts (`docs/api-contracts/`)                                | —                                                      |

Each project keeps its own `package.json` and `node_modules` — there are **no npm/yarn workspaces**. Run
commands from inside the project folder (`cd FullScanApp && npm test`), never from the root.

## Which side owns what

- Anything "admin" (admin portal, admin APIs, back-office screens) lives in `FullScanServer` only — never
  in the RN app.
- The app never assumes an endpoint exists: check `FullScanServer/src/routes/` first.
- The server returns DTOs; the app's repositories map them to domain models. A contract change touches
  the server route + Zod schema + types **and** the app's DTO + mapper + repository.

## Cross-project changes

When a task needs changes on both sides:

1. **Contract first.** Agree the endpoint, request/response shape and error codes, and write it to
   `docs/api-contracts/<feature>.md` before implementing either side.
2. **Server** — delegate to the `server-engineer` agent with the contract.
3. **App** — delegate to the `app-engineer` agent with the same contract (plus anything the server
   step reported). Steps 2 and 3 can run in parallel when the contract is fully fixed up front.
4. **Verify** both sides agree with the contract, and each project's tests pass.

Agents cannot talk to each other — the main session carries information between them.

## Agents

Cross-project agents live in `.claude/agents/` at the repo root. App-specialist agents
(`qa-engineer`, `solution-architect`, …) live in `FullScanApp/.claude/agents/` and are only loaded when
Claude is started inside `FullScanApp/`.
