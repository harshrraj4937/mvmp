# Gillu Architecture Decisions

## ADR-001: Use Drizzle ORM

Status: Accepted

Decision:
Use Drizzle with PostgreSQL.

Reason:
- Existing Relivator integration
- SQL-oriented queries
- TypeScript support
- Avoid unnecessary migration

Alternatives:
- Prisma
- TypeORM

---

## ADR-002: Modular Monolith

Status: Accepted

Decision:
Use one commerce application with separate
payment and shipping workers.

Reason:
- Simpler transactions
- Easier development
- Lower operational complexity
- Services can be extracted later

---

## ADR-003: Cashfree

Status: Accepted

Decision:
Use Cashfree for prepaid payments.

---

## ADR-004: Shiprocket

Status: Accepted

Decision:
Use Shiprocket for logistics integration.

---

## ADR-005: Merchant Settlement

Status: Deferred

Decision:
Final settlement rules will be decided
after MVP validation and merchant interviews.
