# Embedded backend plan

Goal: a person installs the desktop app and it works. No backend to deploy, no Docker, no Node. Everything runs on the user's machine, under the user's control, and nothing leaves it.

## Today

- The installer ships only the renderer and the Electron main process (`apps/electron/electron-builder.js`, `files`).
- The renderer talks to `http://localhost:3001` (`apps/electron/src/shared/constants/api.ts`) and expects someone to have started the backend and PostgreSQL by hand.
- The packaged app loads the renderer from `file://`. The session cookie is `SameSite=Lax`, so a `file://` page cannot send it to `localhost:3001`. Login in the packaged app was never going to work.
- The database schema has three copies that drifted: the Drizzle schema in TypeScript, 44 migration files with a journal that lists only 11, and a 750-line DDL inside the backend test helper.

## Target

```
MarketMind.app/Contents/Resources/
  app.asar                          main + preload + renderer build
  backend/index.js                  one esbuild bundle of apps/backend (ESM, Node 24)
  backend/node_modules/@node-rs/…   the only native dependency (argon2), kept external
  backend/migrations/               Drizzle migrations folder (sql + meta/_journal.json)
  backend/strategies/builtin/       the 107 .pine strategies
  postgres/                         PostgreSQL 17 binaries for this platform (bin/, lib/, share/)

~/Library/Application Support/MarketMind/      (app.getPath('userData'))
  data/postgres/                    PGDATA, created on first run
  data/logs/  data/output/          backend logs and CLI output
  data/strategies/user/             the user's own .pine files, loaded next to the builtin ones
  secrets.json                      ENCRYPTION_KEY, SESSION_SECRET and the database password,
                                    encrypted with Electron safeStorage (OS keychain)
```

Boot sequence in the main process:

1. Single-instance lock. A second launch focuses the running window.
2. Load or create the secrets.
3. Start PostgreSQL: `initdb` on first run (UTF8, locale C, scram auth, loopback only), then `pg_ctl start` on a free port.
4. Start the backend as an Electron `utilityProcess` (Electron 44 ships Node 24.21, the version the backend requires). It receives `DATABASE_URL`, a free `PORT`, `HOST=127.0.0.1`, the secrets, `NODE_ENV=production`, and the `MM_*` paths below. It runs the Drizzle migrations before it listens.
5. Wait for `GET /health`, then load the main window from `http://127.0.0.1:<port>/`. The backend serves the renderer build, so page and API share one origin: cookies and CORS behave exactly as in development.
6. A small boot window shows each step. On failure it shows the error with "open logs" and "retry".
7. On quit: stop the backend, then `pg_ctl stop -m fast`.

Development keeps working as before: with `VITE_DEV_SERVER_URL` set, the app does not start the embedded stack and talks to the backend from `pnpm dev`. `MM_BACKEND_URL=<origin>` skips the embedded stack in a packaged app too, for people who self-host the backend.

## Decisions

| Question | Decision | Why |
|---|---|---|
| Real PostgreSQL or an in-process engine (PGlite)? | Real PostgreSQL 17 binaries from `@embedded-postgres/<platform>` | Zero changes to the data layer, real connection pool, `pg_dump` available for backups. About 40 MB compressed per platform. |
| Who starts PostgreSQL, main or backend? | Electron main | Backend restarts do not restart the database, and the boot window can report each step. |
| Node runtime for the backend | Electron's own Node via `utilityProcess.fork` | No second runtime to ship. `@node-rs/argon2` is N-API, so it works unchanged. |
| Renderer origin | Served by the backend (`@fastify/static`) | Makes page and API same-origin. Fixes cookies and CORS for good. |
| TimescaleDB | Not shipped | `init.sql` only enables the extension; no hypertable, policy or `time_bucket` exists in code or migrations. |
| Schema source of truth | The Drizzle TypeScript schema, squashed into one baseline migration | Fresh installs run the migrator at boot. The backend tests build their database from the same migrations, so every test run proves the baseline. |
| Secrets | Generated once per install, stored with `safeStorage` | Same keys the self-hosted `.env` holds today; never written in plain text. |
| Email features (verification, 2FA, reset) | Unchanged, off without `RESEND_API_KEY` | Out of scope. Documented as optional. |

## Phase A — make the backend embeddable (`feat/embeddable-backend`)

- `env.ts`: `HOST` (default `0.0.0.0`), `COOKIE_SECURE` (default: production), `MM_DATA_DIR`, `MM_STRATEGIES_DIR`, `MM_USER_STRATEGIES_DIR`, `MM_MIGRATIONS_DIR`, `MM_RUN_MIGRATIONS`, `MM_RENDERER_DIR`, `MM_EMBEDDED`.
- One `paths.ts` for every filesystem location. The eight places that build `strategies/builtin` from `__dirname` or `process.cwd()` use it. Logs and output move under `MM_DATA_DIR` when set.
- `PineStrategyLoader` tolerates a missing directory and loads `MM_USER_STRATEGIES_DIR` after the builtin one.
- `db/migrate.ts` runs `drizzle-orm/node-postgres/migrator` when `MM_RUN_MIGRATIONS=true`, before any service starts.
- Migrations squashed into one baseline generated from the schema. The baseline is validated against the current development database (same tables, columns, types, defaults, nullability, indexes) before it replaces the old files. `pnpm db:mark-baseline` records the baseline as applied on an existing database so `pnpm db:migrate` works from then on.
- Backend tests create their schema with the migrator instead of the hand-written DDL.
- `@fastify/static` serves `MM_RENDERER_DIR` at `/` with an SPA fallback for GET requests outside `/trpc`, `/health`, `/ready` and `/socket.io`. Helmet's CSP gets the `connect-src` and `img-src` the renderer needs; COEP stays off when the renderer is served.
- `listen({ host: env.HOST })`. Loopback is rate-limit exempt in embedded mode.
- `scripts/build/bundle-embedded.mjs`: esbuild bundle to `dist-embedded/` plus migrations, strategies and the argon2 packages. `node dist-embedded/index.js` must boot against the development database and serve the renderer.

## Phase B — the embedded stack in Electron (`feat/embedded-stack`)

- `src/main/embedded/`: `secrets.ts`, `ports.ts`, `EmbeddedPostgres.ts` (initdb, pg_ctl, stop), `BackendProcess.ts` (utilityProcess, health wait, restart with backoff, log file), `BootWindow.ts`, `bootstrap.ts` (the sequence above, with resource paths for packaged and unpackaged runs).
- `main/index.ts`: single-instance lock, boot before the main window, `loadURL` for main and chart windows, stack shutdown on quit.
- Preload exposes `window.electron.backend.url` (from `--mm-backend-url`). `api.ts` prefers it over the `localhost:3001` default.
- `electron-builder.js`: `extraResources` for the backend bundle and for the platform's PostgreSQL binaries. `pnpm-workspace.yaml` `supportedArchitectures` so both macOS architectures install.
- `build` bundles the backend before `electron-builder`; the release workflow does the same on both runners.
- Tests: unit tests for ports, secrets, env assembly and the boot state machine; an Electron end-to-end test that boots the real stack in a temporary `userData`, waits for the login page and checks `/health`.
- Settings → About shows the data folder and opens it.

## Phase C — documentation, site, release

- README install section (download, open, create the local account, paper wallet), `QUICK_START.md` stays the developer path, `RELEASE_PROCESS.md`, `CLAUDE.md` architecture note, `CHANGELOG.md`.
- Site: "Get started" becomes install → first run → wallet; requirements drop Node and Docker; the "Runs on your machine" card says the backend and PostgreSQL run inside the app.
- Release v1.28.0.

## Risks and how each is checked

- **Unsigned macOS build.** The nested PostgreSQL binaries inherit the app's quarantine. Once the user allows the app, child executables run. Checked on a clean machine before the release; notarization is the real fix and needs an Apple Developer account.
- **PostgreSQL on Windows refuses to run as Administrator.** The NSIS installer is per-user by default, so the app runs as the user. Checked on the Windows build.
- **Data directory path with spaces or non-ASCII characters.** `initdb` and `pg_ctl` receive quoted paths; the end-to-end test uses a temporary directory with a space in its name.
- **Two app instances against one PGDATA.** Prevented by the single-instance lock.
- **PostgreSQL major upgrades.** PGDATA is tied to major 17. Bumping the major later needs a `pg_upgrade` step or a dump-and-restore on boot; the plan pins 17 and records the major in `data/postgres/PG_VERSION`.
- **Schema drift between the baseline and the development database.** The baseline is diffed against the live database before it lands, and the whole backend test suite runs on it.
