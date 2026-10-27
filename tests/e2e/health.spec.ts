import { expect, test } from "./helpers";

test("health endpoint is ok and echoes a request id", async ({ request }) => {
  const response = await request.get("/api/health", {
    headers: { "x-request-id": "e2e-health-check-01" },
  });
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({
    checks: { database: "ok" },
    status: "ok",
  });
  expect(response.headers()["x-request-id"]).toBe("e2e-health-check-01");
  expect(response.headers()["cache-control"]).toContain("no-store");
});

test("pages get a generated request id when none is sent", async ({
  request,
}) => {
  const response = await request.get("/");
  expect(response.headers()["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/);
});
