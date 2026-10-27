# Gillu Phase 0–1 (Audit + Foundation) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Record the verified audit and tracking docs (Phase 0), then turn Relivator into a clean, tested foundation: Polar removed, Next 16 / better-auth 1.7 / Zod 4 / drizzle 0.45, generated migrations, admin role enforcement, structured logging with request ids, health check, and a Docker Compose stack (postgres, redis, migrate, web, nginx) — with auth proven working by an E2E test before and after the changes (Phase 1).

**Architecture:** Keep the existing Next.js app and better-auth setup; add `src/platform/` (env, logger, request id, health) and `src/modules/identity/` (session/admin guards) as the first modular-monolith pieces. Tests live in `tests/{unit,integration,e2e}`; integration tests use a Testcontainers Postgres with real migrations; E2E runs Playwright against a production build on a throwaway Postgres.

**Tech Stack:** bun (package manager), Node runtime, Next.js 16, React 19, better-auth 1.7 (+ admin, twoFactor, nextCookies plugins), drizzle-orm 0.45 + drizzle-kit 0.31 + postgres-js, Zod 4, pino, Vitest 5, @testcontainers/postgresql, Playwright, Docker Compose, nginx.

**Spec:** `docs/superpowers/specs/2026-10-27-gillu-marketplace-design.md` (approved). Requirements source: `diagrams/implementation-prompt.txt`.

## Global Constraints

- Upgrade to latest Next.js 16.x, latest better-auth 1.7.x, Zod 4.x (user decision D1). React to latest 19.x. drizzle-orm `^0.45.2` (better-auth peer requirement); drizzle-kit latest 0.31.x.
- All other dependencies keep their current major: TypeScript stays 5.x (latest 5.9.x, **not** 7), ESLint 9, Biome 1.9.4, eslint-react 1.x, perfectionist 4.x, knip 5.x, Tailwind 4.
- New libraries (vitest, @playwright/test, @testcontainers/postgresql, pino) install at their current latest.
- Package manager is bun (`bun.lock` committed); runtime for Next and scripts in Docker is Node ≥ 20.9 (Docker base `node:22-bookworm-slim`).
- Use Context7 (`npx ctx7@latest docs <id> "<question>"`) before writing code against any library API; IDs: `/vercel/next.js/v16.2.9`, `/better-auth/better-auth`, `/colinhacks/zod/v4.6.5`, `/vitest-dev/vitest/v5.0.3`, `/testcontainers/testcontainers-node/v12.2.0`.
- No Polar, Stripe, Razorpay or any other payment provider code.
- Never run migrations or `drizzle-kit push` against any database except throwaway test containers or the compose database. Never print `.env` values.
- Secrets never reach client bundles or logs.
- Import alias `~/` → `src/`; follow existing Biome formatting (2 spaces, double quotes, 80 cols) and perfectionist natural import ordering.
- Work happens on branch `gillu/phase-0-1`, never directly on `main`.
- Commit messages end with: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
- A phase is marked COMPLETED in `diagrams/implementation-progress.md` only after its verification commands were actually run and passed; failures are recorded verbatim, never hidden.

## Review Focus

1. A signed-in non-admin user opening `/admin/summary` (or any `/admin/*`) — must get a 404, never other users' data. → Task 8 E2E `non-admin cannot open admin pages`.
2. Database down while the app is up — `/api/health` must answer 503 within ~2 s, not hang or 500. → Task 9 integration `reports unreachable for a dead database within the timeout`.
3. Missing or malformed `DATABASE_URL` / short `AUTH_SECRET` at startup — must fail with a message naming the variable and never echo its value. → Task 3 unit tests.
4. Re-deploy runs migrations a second time — must be a no-op, not an error. → Task 7 integration `running migrations twice is a no-op`.
5. A client-sent `x-request-id` containing newlines/huge strings (log injection) — must be replaced by a generated id. → Task 9 unit `rejects unsafe incoming ids`.

---

## File Structure

```
diagrams/approved-architecture.txt       Phase 0: approved target HLD (rewrite)
diagrams/implementation-progress.md      Phase 0: reset tracker (canonical)
diagrams/decisions.md                    Phase 0: ADRs (canonical)
docs/architecture.md                     as-built architecture (canonical)
docs/implementation-plan.md              phase checklist → links to per-phase plans
docs/{decisions,implementation-progress}.md   one-line pointers to diagrams/
docs/{database-design,api-contracts,merchant-workflow,order-lifecycle,testing,deployment}.md
docs/integrations/{cashfree,shiprocket}.md
vitest.config.ts                         unit + integration projects
playwright.config.ts                     E2E against next start :3100
docker-compose.test.yml                  postgres-test (tmpfs, :54329)
scripts/e2e.ts                           compose up → migrate → build → playwright
scripts/admin-grant.ts                   CLI: grant admin role by email
drizzle/                                 generated SQL migrations
src/platform/env.ts                      Zod 4 server env parsing
src/platform/logger.ts                   pino JSON logger
src/platform/request-id.ts               request id resolution
src/platform/health.ts                   DB health probe
src/proxy.ts                             Next 16 proxy: request id
src/app/api/health/route.ts              health endpoint
src/db/migrate.ts                        programmatic migrations (tests)
src/modules/identity/index.ts            public API: requireSession, requireAdmin, isAdmin
src/modules/identity/application/grant-admin.ts
deploy/nginx/default.conf                reverse proxy
tests/unit/**  tests/integration/**  tests/e2e/**
```

Deleted: `.tests/`, `src/api/payments/`, `src/app/api/payments/`, `src/db/schema/payments/`, `src/app/dashboard/billing/`, `src/ui/components/payments/`.

---

## PHASE 0

### Task 1: Branch, preserve existing work, write Phase 0 docs

**Files:**
- Create: everything under `docs/` listed above except `docs/superpowers/**` (already exists), rewrite the three `diagrams/` tracking files.
- Commit as-is (pre-existing, user-authored, uncommitted): `Dockerfile`, `.dockerignore`, `docker-compose.yml`, `.env.docker.example`, `README.md`, `next.config.ts`, `src/lib/queries/uploads.ts`, and the other `diagrams/*.txt` files.

**Interfaces:**
- Produces: the tracker format later tasks update — `diagrams/implementation-progress.md` has one `### Phase N — <name>` section per phase (0–9) with `Status: NOT_STARTED|IN_PROGRESS|COMPLETED|BLOCKED`, a checklist copied from requirements §26 for that phase, and a `#### Verification` subsection; plus a top-level `## Phase Reports` section using the requirements §29 template.

- [ ] **Step 1: Create the branch and commit the pre-existing work untouched**

```bash
git switch -c gillu/phase-0-1
git add Dockerfile .dockerignore docker-compose.yml .env.docker.example README.md next.config.ts src/lib/queries/uploads.ts diagrams/
git commit -m "chore: preserve pre-existing Docker setup, uploads query fix and Gillu design notes"
```
Expected: `git status --short` shows only `docs/` as untracked.

- [ ] **Step 2: Rewrite `diagrams/approved-architecture.txt`**

Content (plain text + Mermaid): the approved target architecture from spec §5 (flowchart incl. outbox dispatcher, both workers, webhooks, nginx), the technology stack list (versions per Global Constraints), the 12 modules with one-line ownership each (requirements §6), the table-by-phase list from spec §6, the roles model (spec C3). Header line: `Approved target architecture — see docs/architecture.md for what is actually built.`

- [ ] **Step 3: Reset `diagrams/implementation-progress.md`**

All phases `NOT_STARTED`, every checkbox unchecked, except Phase 0 = `IN_PROGRESS`. Add `## Audit Notes` stating the previous version's claims (Phases 0–1 complete, merchant schema built) were verified false on 2026-10-27 and why (Polar wired, no merchant tables, no tests). `## Blockers`: none for Phases 0–1; list the open items from spec §10 under their phases as `NEEDS_INPUT`.

- [ ] **Step 4: Rewrite `diagrams/decisions.md` as ADRs**

Format per ADR: `## ADR-NNN: <title>`, `Status: Accepted|Deferred`, `Date: 2026-10-27`, `Decision:`, `Reason:`, `Alternatives:` (when any). Accepted: Drizzle+Postgres; modular monolith; separate worker processes + transactional outbox + BullMQ; Cashfree; Shiprocket (platform account + per-merchant pickup locations); better-auth + Google + admin plugin roles + membership-based merchant role (C3, C3a); remove Polar; upgrade Next 16/better-auth 1.7/Zod 4 (D1); bun as package manager (C1); tracking files location (C2); cuid2 ids + `GIL-<n>` order numbers (C4); integer paise in bigint (C5); generated migrations (C6); UploadThing behind port (C7); pino + request id (C8); worker build (C9); compose scope per phase (C10). Deferred: settlement/payouts; pricing formula & commissions; penalty policy; S3 adapter; per-merchant Shiprocket accounts.

- [ ] **Step 5: Write `docs/architecture.md` and `docs/implementation-plan.md`**

`architecture.md` = as-built state: today it is Relivator (describe current auth, DB, uploads, storefront-on-mocks, audit table from spec §3 and its technical risks) plus a "Target" link to `diagrams/approved-architecture.txt`. Each later phase updates the as-built sections. `implementation-plan.md` = the 10 phases with deliverables (requirements §26), status mirror note ("status lives in diagrams/implementation-progress.md"), and links: Phase 0–1 → this plan file.

- [ ] **Step 6: Write pointer and skeleton docs**

`docs/decisions.md` and `docs/implementation-progress.md`: one paragraph each pointing at the `diagrams/` file. Skeletons (`database-design.md`, `api-contracts.md`, `merchant-workflow.md`, `order-lifecycle.md`, `testing.md`, `deployment.md`, `integrations/cashfree.md`, `integrations/shiprocket.md`): title, `Status: NOT_STARTED — filled in Phase N` (database-design: 1+, api-contracts: 2+, merchant-workflow: 2, order-lifecycle: 5, testing: 1, deployment: 1, cashfree: 6, shiprocket: 7), and a link to the spec section that governs it. No unverified claims.

- [ ] **Step 7: Mark Phase 0 COMPLETED and commit**

Set Phase 0 `Status: COMPLETED`, tick its checklist, add a Phase 0 report (requirements §29 template; TESTS EXECUTED: none — documentation phase).

```bash
git add docs diagrams
git commit -m "docs: Phase 0 repository audit, approved architecture, ADRs and progress tracker"
```

---

## PHASE 1

### Task 2: Toolchain and recorded baseline

**Files:**
- Modify: `package.json` (scripts only)
- Modify: `diagrams/implementation-progress.md` (Phase 1 `#### Baseline` subsection)

- [ ] **Step 1: Install bun for the user and install dependencies**

Run: `curl -fsSL https://bun.sh/install | bash` (or `npm i -g bun` if curl install is blocked), then `~/.bun/bin/bun --version` → prints a 1.x version. Then `bun install --frozen-lockfile` → exits 0.

- [ ] **Step 2: Add non-mutating check scripts to `package.json`**

```json
"typecheck": "tsc --noEmit",
"lint": "eslint . && biome check .",
"knip": "knip"
```
Keep the existing `check` script (it auto-fixes; not used as a gate).

- [ ] **Step 3: Record baseline results**

Run each and capture exit code + first error lines: `bun run typecheck`, `bun run lint`, `bun run knip`, `DATABASE_URL=postgresql://x:x@localhost:5432/x AUTH_SECRET=baseline-placeholder-secret-0123456789abcdef NEXT_SERVER_APP_URL=http://localhost:3000 NEXT_PUBLIC_APP_URL=http://localhost:3000 bun run build`. Write the results verbatim into the Baseline subsection. Do **not** fix anything in this task.

- [ ] **Step 4: Commit**

```bash
git add package.json bun.lock diagrams/implementation-progress.md
git commit -m "chore: add non-mutating check scripts and record Phase 1 baseline"
```

### Task 3: Vitest + Zod 4 server env parsing

**Files:**
- Create: `vitest.config.ts`, `src/platform/env.ts`, `tests/unit/platform/env.test.ts`
- Modify: `package.json`, `src/db/index.ts`, `src/lib/auth.ts` (`secret`/`baseURL` read from parsed env)
- Delete: `.tests/` (Polar mock test + machine-env test replaced by this)

**Interfaces:**
- Produces: `parseServerEnv(source: Record<string, string | undefined>): ServerEnv` (throws `Error` whose message lists only the failing variable names); `getServerEnv(): ServerEnv` (parses `process.env` once, caches); `type ServerEnv = { DATABASE_URL: string; AUTH_SECRET: string; NEXT_SERVER_APP_URL: string; NEXT_PUBLIC_APP_URL: string; AUTH_GOOGLE_ID?: string; AUTH_GOOGLE_SECRET?: string; AUTH_GITHUB_ID?: string; AUTH_GITHUB_SECRET?: string; UPLOADTHING_TOKEN?: string; REDIS_URL?: string; LOG_LEVEL: "fatal"|"error"|"warn"|"info"|"debug"|"trace" }`.
- Produces: `vitest.config.ts` with projects `unit` (`tests/unit/**/*.test.ts`, env node) and `integration` (`tests/integration/**/*.test.ts`, added in Task 7); alias `~` → `./src`.

- [ ] **Step 1: Install**

`bun add zod@^4` and `bun add -d vitest@latest`. Scripts: `"test": "vitest run"`, `"test:unit": "vitest run --project unit"`. Remove `"tests"`.

- [ ] **Step 2: Write failing tests `tests/unit/platform/env.test.ts`**

```ts
const valid = {
  AUTH_SECRET: "a".repeat(32),
  DATABASE_URL: "postgresql://u:p@localhost:5432/gillu",
  NEXT_PUBLIC_APP_URL: "http://localhost:3000",
  NEXT_SERVER_APP_URL: "http://localhost:3000",
};
test("accepts a minimal valid environment and defaults LOG_LEVEL to info", () => {
  expect(parseServerEnv(valid)).toMatchObject({ ...valid, LOG_LEVEL: "info" });
});
test("treats empty optional provider credentials as absent", () => {
  expect(parseServerEnv({ ...valid, AUTH_GOOGLE_ID: "" }).AUTH_GOOGLE_ID).toBeUndefined();
});
test("names a missing DATABASE_URL", () => {
  const { DATABASE_URL: _, ...rest } = valid;
  expect(() => parseServerEnv(rest)).toThrow(/DATABASE_URL/);
});
test("rejects a non-postgres DATABASE_URL", () => {
  expect(() => parseServerEnv({ ...valid, DATABASE_URL: "mysql://u:p@h/db" })).toThrow(/DATABASE_URL/);
});
test("rejects a short AUTH_SECRET without echoing it", () => {
  const secret = "short-secret-value";
  let message = "";
  try { parseServerEnv({ ...valid, AUTH_SECRET: secret }); } catch (e) { message = (e as Error).message; }
  expect(message).toMatch(/AUTH_SECRET/);
  expect(message).not.toContain(secret);
});
```

- [ ] **Step 3: Run — expect FAIL** (`bun run test:unit` → cannot resolve `~/platform/env`).

- [ ] **Step 4: Implement `src/platform/env.ts`**

Zod 4 object: URLs via `z.url()`; `DATABASE_URL` additionally refined to start with `postgres://` or `postgresql://`; `AUTH_SECRET` `z.string().min(32)`; optional strings preprocessed so `""` → `undefined`; `LOG_LEVEL` enum default `"info"`. On failure throw `new Error("Invalid server environment: " + <comma-joined issue paths>)` — paths only, never inputs. Wire `getServerEnv()` into `src/db/index.ts` (replace the manual `DATABASE_URL` check) and into `src/lib/auth.ts` for `secret` and `baseURL`. Do not import `server-only` in `src/platform/env.ts` (workers will reuse it).

- [ ] **Step 5: Run — expect PASS** (`bun run test:unit` → 5 passed). Also `bun run typecheck` → no new errors vs baseline.

- [ ] **Step 6: Delete `.tests/`, commit**

```bash
git rm -r .tests
git add vitest.config.ts src/platform/env.ts tests/unit src/db/index.ts src/lib/auth.ts package.json bun.lock
git commit -m "test: add Vitest and Zod 4 server environment validation"
```

### Task 4: Playwright auth smoke E2E on a throwaway database

**Files:**
- Create: `playwright.config.ts`, `docker-compose.test.yml`, `scripts/e2e.ts`, `tests/e2e/auth.spec.ts`, `tests/e2e/helpers.ts`
- Modify: `package.json`, `.gitignore` (`/test-results`, `/playwright-report`)

**Interfaces:**
- Produces: `bun run test:e2e` — the single command every later task uses for E2E.
- Produces: `tests/e2e/helpers.ts`: `uniqueEmail(prefix: string): string`; `signUp(page: Page, user: { name: string; email: string; password: string }): Promise<void>`; `signIn(page: Page, email: string, password: string): Promise<void>`; `sessionEmail(page: Page): Promise<string | null>` (GET `/api/auth/get-session`, returns `user.email` or null).
- Produces: E2E constants: app on `http://localhost:3100`, test DB `postgresql://gillu_test:gillu_test@localhost:54329/gillu_test`.

- [ ] **Step 1: Install** `bun add -d @playwright/test@latest` then `bunx playwright install chromium`.

- [ ] **Step 2: `docker-compose.test.yml`** — one service `postgres-test`: `postgres:16-alpine`, env user/db/password `gillu_test`, `ports: ["127.0.0.1:54329:5432"]`, `tmpfs: /var/lib/postgresql/data`, `pg_isready` healthcheck.

- [ ] **Step 3: `scripts/e2e.ts`** (run with bun) — sets the E2E env (DATABASE_URL above, `AUTH_SECRET` random 48 hex chars generated per run, both app URLs `http://localhost:3100`); runs in order, aborting on non-zero exit: `docker compose -f docker-compose.test.yml up -d --wait`; schema step `bunx drizzle-kit push --force` (**temporary**; Task 7 replaces it with `bun run db:migrate`); `bun run build`; `bunx playwright test` (forwarding extra CLI args); always finishes with `docker compose -f docker-compose.test.yml down -v`. Script `"test:e2e": "bun scripts/e2e.ts"`.

- [ ] **Step 4: `playwright.config.ts`** — `testDir: "tests/e2e"`, chromium only, `baseURL: "http://localhost:3100"`, `webServer: { command: "bun run start -- -p 3100", url: "http://localhost:3100", reuseExistingServer: false, timeout: 120_000 }`, retries 0, `trace: "retain-on-failure"`.

- [ ] **Step 5: Write `tests/e2e/auth.spec.ts`**

```ts
test("sign up, sign in and sign out with email and password", async ({ page }) => {
  const user = { name: "Asha Test", email: uniqueEmail("smoke"), password: "Correct-Horse-9-Battery" };
  await signUp(page, user);                       // fills #name #email #password, submits
  await expect(page).toHaveURL(/\/auth\/sign-in\?registered=true/);
  await signIn(page, user.email, user.password);
  await expect(page).toHaveURL(/\/dashboard\/uploads/);
  expect(await sessionEmail(page)).toBe(user.email);
  await page.goto("/auth/sign-out");
  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page).toHaveURL("http://localhost:3100/");
  expect(await sessionEmail(page)).toBeNull();
});
test("wrong password does not create a session", async ({ page }) => {
  const user = { name: "Ravi Test", email: uniqueEmail("wrongpw"), password: "Correct-Horse-9-Battery" };
  await signUp(page, user);
  await signIn(page, user.email, "not-the-password");
  await expect(page).toHaveURL(/\/auth\/sign-in/);
  expect(await sessionEmail(page)).toBeNull();
});
```

- [ ] **Step 6: Run** `bun run test:e2e`.

Expected: 2 passed. **Known risk:** with Polar's `createCustomerOnSignUp: true` and no Polar token, sign-up may fail on the current code. If the only failures trace to Polar, record the exact error in the Phase 1 Baseline and continue — Task 5 must turn this green. Any other failure: stop and debug (superpowers:systematic-debugging).

- [ ] **Step 7: Commit**

```bash
git add playwright.config.ts docker-compose.test.yml scripts/e2e.ts tests/e2e package.json bun.lock .gitignore diagrams/implementation-progress.md
git commit -m "test: add Playwright auth smoke test against a throwaway Postgres"
```

### Task 5: Remove Polar

**Files:**
- Delete: `src/api/payments/`, `src/app/api/payments/`, `src/db/schema/payments/`, `src/app/dashboard/billing/`, `src/ui/components/payments/`
- Modify: `src/lib/auth.ts` (drop `polar` plugin, `Polar` client, imports), `src/db/schema/index.ts` (drop payments exports), any nav/link to `/dashboard/billing` (`grep -rn billing src`), `.env.example`, `.env.docker.example`, `README.md` (Polar sections), `knip.json` if it references removed files, `package.json` (remove `@polar-sh/better-auth`, `@polar-sh/sdk`)

- [ ] **Step 1: Remove code, schema, deps, env vars, docs** as listed. `bun remove @polar-sh/better-auth @polar-sh/sdk`.

- [ ] **Step 2: Verify no references remain**

Run: `grep -rniE 'polar' --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=diagrams --exclude-dir=docs . | grep -v bun.lock`
Expected: no output.

- [ ] **Step 3: Verify** `bun run typecheck` (no errors beyond baseline), `bun run test:unit` (pass), `bun run test:e2e` (2 passed — must be green now).

- [ ] **Step 4: Commit**

```bash
git add -A src package.json bun.lock .env.example .env.docker.example README.md knip.json
git commit -m "refactor: remove Polar subscription billing integration"
```

### Task 6: Upgrade Next 16, React 19.x, better-auth 1.7, drizzle 0.45

**Files:**
- Modify: `package.json`, `next.config.ts` (remove `eslint` key), `src/lib/auth.ts` (append `nextCookies()` as the **last** plugin), `src/db/schema/users/tables.ts` (regenerated), `src/lib/auth-db.ts` (CLI moved to the `auth` package), any code the upgrades break.

- [ ] **Step 1: Read upgrade docs via Context7** — Next 16 upgrade guide (`/vercel/next.js/v16.2.9` "version 16 upgrade breaking changes"), better-auth changelog/migration 1.2→1.7 (`/better-auth/better-auth` "breaking changes migration 1.3 1.4 1.5 1.6 1.7"). Note every breaking change touching code in this repo in the commit body.

- [ ] **Step 2: Upgrade**

`bun add next@latest react@latest react-dom@latest better-auth@latest drizzle-orm@latest` (`drizzle-orm` must resolve to 0.45.x — pin `^0.45.2` if `latest` is 1.x) and `bun add -d drizzle-kit@^0.31 @types/react@latest @types/react-dom@latest typescript@~5.9`.

- [ ] **Step 3: Regenerate the auth schema**

Update `src/lib/auth-db.ts` to invoke `npx auth@latest generate --config ./src/lib/auth.ts --output ./src/db/schema/users/tables.ts` (confirm flags with `npx auth@latest generate --help` first). Run `bun run db:auth`. Review the diff of `tables.ts`: expected changes are better-auth 1.7 column additions only; table names must stay `user`, `session`, `account`, `verification`, `two_factor`.

- [ ] **Step 4: Fix breakages until green**

Run `bun run typecheck`, `bun run lint`, build (same env as Task 2 Step 3). Fix only what the upgrade broke; record any lint rule changes needed.

- [ ] **Step 5: Verify** `bun run test:unit` pass, `bun run test:e2e` 2 passed.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "build: upgrade to Next.js 16, better-auth 1.7, drizzle-orm 0.45"
```

### Task 7: Generated migrations + integration test project

**Files:**
- Modify: `drizzle.config.ts` (`out: "./drizzle"`), `package.json` (scripts `db:generate`: `drizzle-kit generate`, `db:migrate`: `drizzle-kit migrate`, `test:integration`: `vitest run --project integration`), `vitest.config.ts` (add `integration` project: `globalSetup: "tests/integration/global-setup.ts"`, `testTimeout: 60_000`, `hookTimeout: 120_000`), `scripts/e2e.ts` (replace `drizzle-kit push --force` with `bun run db:migrate`)
- Create: `drizzle/0000_*.sql` + `drizzle/meta/*` (generated), `src/db/migrate.ts`, `tests/integration/global-setup.ts`, `tests/integration/db/migrations.test.ts`

**Interfaces:**
- Produces: `runMigrations(databaseUrl: string): Promise<void>` in `src/db/migrate.ts` (postgres-js client `max: 1`, `migrate()` from `drizzle-orm/postgres-js/migrator`, `migrationsFolder: "drizzle"`, closes its client).
- Produces: integration global setup starts `new PostgreSqlContainer("postgres:16-alpine")`, runs `runMigrations`, `project.provide("databaseUrl", uri)`; tests read it with `inject("databaseUrl")`; container stopped in teardown. Declares `ProvidedContext { databaseUrl: string }`.

- [ ] **Step 1: Install** `bun add -d @testcontainers/postgresql@latest`.

- [ ] **Step 2: Generate the baseline migration**

Run: `bun run db:generate` (needs no DB). Expected: `drizzle/0000_<name>.sql` creating `user`, `session`, `account`, `verification`, `two_factor`, `uploads`, enum `type`; **no** `polar_*` tables (`grep -il polar drizzle/` → no output).

- [ ] **Step 3: Write failing tests `tests/integration/db/migrations.test.ts`**

```ts
test("baseline creates auth and uploads tables and no Polar tables", async () => {
  const tables = await listPublicTables(inject("databaseUrl")); // select table_name from information_schema.tables where table_schema='public'
  expect(tables).toEqual(expect.arrayContaining(["user", "session", "account", "verification", "two_factor", "uploads"]));
  expect(tables.filter((t) => t.startsWith("polar"))).toEqual([]);
});
test("running migrations twice is a no-op", async () => {
  await expect(runMigrations(inject("databaseUrl"))).resolves.toBeUndefined();
});
```

- [ ] **Step 4: Run — expect FAIL** (`bun run test:integration` → missing `global-setup`/`runMigrations`).

- [ ] **Step 5: Implement** `src/db/migrate.ts` and `tests/integration/global-setup.ts` per Interfaces. Switch `scripts/e2e.ts` to `bun run db:migrate`.

- [ ] **Step 6: Verify** `bun run test:integration` → 2 passed; `bun run test:e2e` → 2 passed.

- [ ] **Step 7: Commit**

```bash
git add drizzle drizzle.config.ts src/db/migrate.ts tests/integration vitest.config.ts scripts/e2e.ts package.json bun.lock
git commit -m "feat(db): switch to generated Drizzle migrations with a baseline"
```

### Task 8: Admin role (better-auth admin plugin) and admin route guard

**Files:**
- Create: `src/modules/identity/index.ts`, `src/modules/identity/domain/roles.ts`, `src/modules/identity/application/grant-admin.ts`, `scripts/admin-grant.ts`, `tests/unit/identity/roles.test.ts`, `tests/integration/identity/grant-admin.test.ts`, `tests/e2e/admin-guard.spec.ts`, `drizzle/0001_*.sql` (generated)
- Modify: `src/lib/auth.ts` (add `admin()` plugin before `nextCookies()`), `src/lib/auth-client.ts` (add `adminClient()`), `src/db/schema/users/tables.ts` (regenerated: `role`, `banned`, `ban_reason`, `ban_expires` on user; `impersonated_by` on session), `src/app/admin/layout.tsx` (replace TODO with `await requireAdmin()`), `scripts/e2e.ts` (export a way for specs to grant admin: run `bun scripts/admin-grant.ts <email>` with the E2E env — used from Phase 2 on), `package.json` (`"admin:grant": "bun scripts/admin-grant.ts"`)

**Interfaces:**
- Produces: `isAdmin(user: { role?: string | null }): boolean` — true iff the comma-separated `role` list contains `"admin"`.
- Produces: `requireSession(): Promise<SessionUser>` — redirects to `/auth/sign-in` when signed out; `requireAdmin(): Promise<SessionUser>` — `requireSession()` then `notFound()` unless `isAdmin`. `type SessionUser = { id: string; email: string; name: string; role: string | null }`. Both import `server-only`; `isAdmin` lives in `domain/roles.ts` without it.
- Produces: `grantAdmin(db: Database, email: string): Promise<"granted" | "already-admin">` — throws `Error("No user with that email")` when absent; updates `user.role` to include `admin`. `Database` = the drizzle db type exported from `src/db/index.ts` (add `export type Database = typeof db`).

- [ ] **Step 1: Write failing unit tests `tests/unit/identity/roles.test.ts`**

```ts
test.each([
  [{ role: "admin" }, true], [{ role: "user,admin" }, true], [{ role: "user" }, false],
  [{ role: null }, false], [{}, false], [{ role: "administrator" }, false],
])("isAdmin(%j) is %s", (user, expected) => expect(isAdmin(user)).toBe(expected));
```

- [ ] **Step 2: Run — FAIL; implement `isAdmin`; run — PASS** (`bun run test:unit`).

- [ ] **Step 3: Add the admin plugin, regenerate schema, generate migration**

`bun run db:auth` then `bun run db:generate` → `drizzle/0001_*.sql` adds only the admin columns (review it; no drops).

- [ ] **Step 4: Write failing integration test `tests/integration/identity/grant-admin.test.ts`**

Insert a user row directly (role `user`); `grantAdmin(db, email)` → `"granted"` and row role contains `admin`; second call → `"already-admin"`; unknown email → rejects `/No user with that email/`.

- [ ] **Step 5: Implement `grantAdmin` + `scripts/admin-grant.ts`** (reads email from argv, uses `getServerEnv()`, prints the result word, exit 1 with message on error). Run `bun run test:integration` → PASS.

- [ ] **Step 6: Write E2E `tests/e2e/admin-guard.spec.ts`**

```ts
test("signed-out visitor is sent to sign-in from admin pages", async ({ page }) => {
  await page.goto("/admin/summary");
  await expect(page).toHaveURL(/\/auth\/sign-in/);
});
test("non-admin cannot open admin pages", async ({ page }) => {
  // sign up + sign in a fresh user via helpers
  const res = await page.goto("/admin/summary");
  expect(res?.status()).toBe(404);
  await expect(page.getByText("Admin Dashboard")).toHaveCount(0);
});
```

- [ ] **Step 7: Implement identity guards, wire `src/app/admin/layout.tsx`, run `bun run test:e2e`** → all passed (auth 2 + admin 2).

- [ ] **Step 8: Commit**

```bash
git add -A src/modules src/lib src/db src/app/admin scripts drizzle tests package.json
git commit -m "feat(identity): enforce admin role on admin pages via better-auth admin plugin"
```

### Task 9: Logger, request id proxy, health endpoint

**Files:**
- Create: `src/platform/logger.ts`, `src/platform/request-id.ts`, `src/platform/health.ts`, `src/proxy.ts`, `src/app/api/health/route.ts`, `tests/unit/platform/request-id.test.ts`, `tests/integration/platform/health.test.ts`, `tests/e2e/health.spec.ts`
- Modify: `package.json` (`bun add pino@latest`), `.env.example` (`LOG_LEVEL=info`)

**Interfaces:**
- Produces: `logger: pino.Logger` (JSON to stdout, level from `getServerEnv().LOG_LEVEL`, `base: { service: process.env.GILLU_SERVICE ?? "web" }`, redact `["*.password", "*.token", "*.secret", "*.authorization", "*.cookie"]`).
- Produces: `REQUEST_ID_HEADER = "x-request-id"`; `resolveRequestId(incoming: string | null): string` — returns `incoming` iff it matches `/^[A-Za-z0-9_-]{8,128}$/`, else `crypto.randomUUID()`.
- Produces: `checkDatabaseHealth(sql: postgres.Sql, timeoutMs?: number): Promise<"ok" | "unreachable">` (default 2000 ms; `select 1` raced against the timeout; never throws).
- Produces: `GET /api/health` → 200 `{ status: "ok", checks: { database: "ok" } }` or 503 `{ status: "degraded", checks: { database: "unreachable" } }`; `Cache-Control: no-store`; `dynamic = "force-dynamic"`.
- Produces: `src/proxy.ts` `export function proxy(request: NextRequest)` — resolves the id, forwards it on the request headers (`NextResponse.next({ request: { headers } })`) and sets it on the response; `config.matcher` excludes `_next/static`, `_next/image`, `favicon.ico`.

- [ ] **Step 1: Failing unit tests `tests/unit/platform/request-id.test.ts`**

```ts
test("keeps a well-formed incoming id", () => expect(resolveRequestId("abc-123_XYZ-789")).toBe("abc-123_XYZ-789"));
test.each([null, "", "short", "has space in it", "line\nbreak-injected", "x".repeat(129)])(
  "rejects unsafe incoming ids (%j)", (bad) => {
    const id = resolveRequestId(bad);
    expect(id).not.toBe(bad);
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
  });
```

- [ ] **Step 2: Run FAIL → implement `request-id.ts` → run PASS.**

- [ ] **Step 3: Failing integration tests `tests/integration/platform/health.test.ts`**

```ts
test("reports ok for a reachable database", async () => {
  const sql = postgres(inject("databaseUrl"), { max: 1 });
  await expect(checkDatabaseHealth(sql)).resolves.toBe("ok");
  await sql.end();
});
test("reports unreachable for a dead database within the timeout", async () => {
  const sql = postgres("postgresql://x:x@127.0.0.1:1/x", { max: 1, connect_timeout: 1 });
  const started = Date.now();
  await expect(checkDatabaseHealth(sql, 2000)).resolves.toBe("unreachable");
  expect(Date.now() - started).toBeLessThan(3000);
  await sql.end({ timeout: 0 });
});
```

- [ ] **Step 4: Run FAIL → implement `health.ts`, `logger.ts`, route (uses `conn` from `src/db/index.ts`), `proxy.ts` → run PASS.**

- [ ] **Step 5: E2E `tests/e2e/health.spec.ts`**

```ts
test("health endpoint is ok and echoes a request id", async ({ request }) => {
  const res = await request.get("/api/health", { headers: { "x-request-id": "e2e-health-check-01" } });
  expect(res.status()).toBe(200);
  expect(await res.json()).toEqual({ status: "ok", checks: { database: "ok" } });
  expect(res.headers()["x-request-id"]).toBe("e2e-health-check-01");
});
```
Run `bun run test:e2e` → all passed.

- [ ] **Step 6: Commit**

```bash
git add -A src/platform src/proxy.ts src/app/api/health tests package.json bun.lock .env.example
git commit -m "feat(platform): structured logging, request ids and health endpoint"
```

### Task 10: Docker Compose stack (postgres, redis, migrate, web, nginx)

**Files:**
- Modify: `docker-compose.yml`, `Dockerfile` (keep stages; builder env adds `NEXT_PUBLIC_APP_URL`/`NEXT_SERVER_APP_URL` consistently; runner unchanged), `.env.docker.example` (add `HTTP_PORT=8080`, `LOG_LEVEL=info`, `REDIS_URL` note; app URLs default `http://localhost:8080`; remove `APP_PORT`), `README.md` (replace the Docker section to match reality: no `db-setup`, migrations via `migrate` service, nginx port)
- Create: `deploy/nginx/default.conf`, `docs/deployment.md` (filled: local vs production workflows, env var table, admin bootstrap via `docker compose run --rm migrate bun run admin:grant <email>`)

**Interfaces:**
- Produces: compose services `postgres` (`gillu-postgres`), `redis` (`gillu-redis`), `migrate` (`gillu-migrate`), `web` (`gillu-web`), `nginx` (`gillu-nginx`) on network `gillu-network`; volumes `postgres_data`, `redis_data`. Later phases add `outbox-dispatcher`, `payment-worker`, `shipping-worker` using the `web` image with another command.

- [ ] **Step 1: Write the compose file**

Requirements per service — postgres: no `ports`, healthcheck `pg_isready`. redis: `redis:7-alpine`, `command: redis-server --appendonly yes`, no `ports`, healthcheck `redis-cli ping`. migrate: `build.target: tooling`, `command: bun run db:migrate`, `DATABASE_URL` composed from `POSTGRES_PASSWORD`, `depends_on: postgres: service_healthy`, `restart: "no"`. web: runner image, `env_file: .env`, `DATABASE_URL` override, `REDIS_URL=redis://redis:6379`, no `ports` (only `expose: 3000`), healthcheck `node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"`, `depends_on: migrate: service_completed_successfully, redis: service_healthy`. nginx: `nginx:1.27-alpine`, mounts `deploy/nginx/default.conf` read-only, `ports: ["${HTTP_BIND:-127.0.0.1}:${HTTP_PORT:-8080}:80"]`, `depends_on: web: service_healthy`.

`default.conf`: upstream `web:3000`; `proxy_set_header Host/X-Forwarded-For/X-Forwarded-Proto/X-Request-Id $request_id` only if the client sent none (`map $http_x_request_id $req_id { "" $request_id; default $http_x_request_id; }`); `client_max_body_size 10m`; `access_log` in JSON (`escape=json`).

- [ ] **Step 2: Smoke test the stack**

```bash
cp .env.docker.example .env.compose-smoke && sed -i "s/^POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=$(openssl rand -hex 16)/; s/^AUTH_SECRET=.*/AUTH_SECRET=$(openssl rand -hex 32)/" .env.compose-smoke
docker compose --env-file .env.compose-smoke up -d --build --wait
curl -fsS -H 'x-request-id: compose-smoke-0001' -D - http://127.0.0.1:8080/api/health
docker compose ps --format '{{.Service}} {{.Ports}}'
docker compose --env-file .env.compose-smoke down -v && rm .env.compose-smoke
```
(`env_file: .env` in compose must point at the same file for this run — make the env file path configurable via `${GILLU_ENV_FILE:-.env}` and set `GILLU_ENV_FILE=.env.compose-smoke`.)
Expected: HTTP 200, body `{"status":"ok","checks":{"database":"ok"}}`, header `x-request-id: compose-smoke-0001`; `migrate` exited 0; only `nginx` lists a published port.

- [ ] **Step 3: Commit**

```bash
git add docker-compose.yml Dockerfile .env.docker.example README.md deploy docs/deployment.md
git commit -m "build(docker): compose stack with postgres, redis, one-shot migrations, web and nginx"
```

### Task 11: Phase 1 gate and report

**Files:**
- Modify: `diagrams/implementation-progress.md`, `docs/architecture.md` (as-built: platform, identity, migrations, compose), `docs/testing.md` (how to run each layer, prerequisites: Docker), `docs/database-design.md` (baseline + admin columns), `knip.json` (only if new entry points need declaring)

- [ ] **Step 1: Run the full gate and capture output**

```bash
bun run typecheck && bun run lint && bun run knip && bun run test:unit && bun run test:integration && bun run test:e2e
DATABASE_URL=postgresql://x:x@localhost:5432/x AUTH_SECRET=gate-placeholder-secret-0123456789abcdef NEXT_SERVER_APP_URL=http://localhost:3000 NEXT_PUBLIC_APP_URL=http://localhost:3000 bun run build
```
Expected: every command exits 0. If a pre-existing baseline lint/knip failure remains that is outside Phase 1's scope, it may stay only if listed under KNOWN ISSUES with the reason; Phase 1 then stays IN_PROGRESS until the user accepts it.

- [ ] **Step 2: Verify security boundaries manually from test evidence**

Confirm and note in the report: admin guard E2E green; `grep -rn "process.env" src --include='*.tsx'` shows no secret (non-`NEXT_PUBLIC_`) vars used in client components; `docker compose ps` evidence that Postgres/Redis publish no ports.

- [ ] **Step 3: Update docs and tracker**

Fill the docs listed above with verified content only. In `diagrams/implementation-progress.md`: tick Phase 1 items that the gate proved; Phase 1 `Status: COMPLETED` only if Step 1 was fully green; add the Phase 1 report (PHASE / STATUS / FEATURES IMPLEMENTED / FILES CHANGED / TESTS EXECUTED / TEST RESULTS with pass counts / KNOWN ISSUES — include "storefront still Relivator mock data until Phase 4", "Google OAuth not exercised: no credentials" / BLOCKERS / NEXT PHASE: Phase 2).

- [ ] **Step 4: Commit**

```bash
git add diagrams docs knip.json
git commit -m "docs: Phase 1 foundation report and as-built architecture"
```
