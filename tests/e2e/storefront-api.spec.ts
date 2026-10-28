import { apiJson, expect, test } from "./helpers";

test("the public product list validates its query", async ({ page }) => {
  const { body, status } = await apiJson(
    await page.request.get("/api/v1/products?page=0"),
  );
  expect(status).toBe(400);
  expect(body.error?.code).toBe("validation_failed");
});

test("an unknown shop is a JSON 404", async ({ page }) => {
  const response = await page.request.get("/api/v1/shops/nope");
  expect(response.status()).toBe(404);
  expect(response.headers()["content-type"]).toContain("application/json");
  expect((await apiJson(response)).body.error?.code).toBe("not_found");
});

test("the public product list returns a paged data envelope", async ({
  page,
}) => {
  const { body, status } = await apiJson(
    await page.request.get("/api/v1/products?sort=price_asc"),
  );
  expect(status).toBe(200);
  const data = body.data as {
    items: unknown[];
    page: number;
    pageSize: number;
    regionCounts: unknown[];
    total: number;
  };
  expect(data.page).toBe(1);
  expect(data.pageSize).toBe(24);
  expect(Array.isArray(data.items)).toBe(true);
  expect(Array.isArray(data.regionCounts)).toBe(true);
});
