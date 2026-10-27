# Gillu Implementation Plan

Phase status lives in [`diagrams/implementation-progress.md`](../diagrams/implementation-progress.md).
Requirements: [`diagrams/implementation-prompt.txt`](../diagrams/implementation-prompt.txt) §26.
Design: [`docs/superpowers/specs/2026-10-27-gillu-marketplace-design.md`](superpowers/specs/2026-10-27-gillu-marketplace-design.md).

Each phase gets a detailed task plan in `docs/superpowers/plans/` written just
before it starts. A phase is complete only under the requirements §29 rule.

| Phase | Deliverable | Detailed plan |
|---|---|---|
| 0 — Repository audit | `docs/architecture.md`, this file, tracking files | [phase 0–1 plan](superpowers/plans/2026-10-27-gillu-phase-0-1-foundation.md) |
| 1 — Foundation | Polar removed, upgraded stack, migrations, Vitest/Playwright, Docker; running app with working authentication | [phase 0–1 plan](superpowers/plans/2026-10-27-gillu-phase-0-1-foundation.md) |
| 2 — Merchant authentication | Merchant can register and access an approved dashboard | not yet written |
| 3 — Product management | Approved merchant can publish real products | not yet written |
| 4 — Customer storefront | Products from multiple merchants visible and purchasable up to checkout entry | not yet written |
| 5 — Internal order system | Customer can place an internal test order without an external payment provider | not yet written |
| 6 — Cashfree | Prepaid and COD checkout work within their tested environments | not yet written |
| 7 — Shiprocket | Merchant can prepare and dispatch orders via the supported sandbox workflow | not yet written |
| 8 — Merchant dashboard completion | Merchant can operate fulfillment from the dashboard | not yet written |
| 9 — E2E hardening | Verified end-to-end marketplace MVP | not yet written |
