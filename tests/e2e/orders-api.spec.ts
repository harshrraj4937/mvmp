import { apiJson, expect, signUpFresh, test } from "./helpers";

test("orders need a session", async ({ request }) => {
  for (const response of [
    await request.get("/api/v1/orders"),
    await request.post("/api/v1/orders", { data: {} }),
    await request.get("/api/v1/merchant/orders"),
  ]) {
    const { body, status } = await apiJson(response);
    expect(status).toBe(401);
    expect(body.error?.code).toBe("unauthorized");
    expect(body.requestId).toBeTruthy();
  }
});

test("a shopper without a shop cannot read merchant orders", async ({
  page,
}) => {
  await signUpFresh(page, "orders-api");
  const { body, status } = await apiJson(
    await page.request.get("/api/v1/merchant/orders"),
  );
  expect(status).toBe(403);
  expect(body.error?.code).toBe("forbidden");
  const mine = await apiJson(await page.request.get("/api/v1/orders"));
  expect(mine.status).toBe(200);
  expect(mine.body.data).toEqual([]);
  const missing = await apiJson(
    await page.request.get("/api/v1/orders/GIL-999999"),
  );
  expect(missing.status).toBe(404);
});
