import { apiJson, expect, signUpFresh, test } from "./helpers";

const address = {
  city: "Panaji",
  fullName: "Asha Naik",
  line1: "12 Fontainhas Road",
  phone: "98765 43210",
  postalCode: "403001",
  state: "goa",
};

test("addresses need a session", async ({ request }) => {
  const { body, status } = await apiJson(
    await request.get("/api/v1/account/addresses"),
  );
  expect(status).toBe(401);
  expect(body.error?.code).toBe("unauthorized");
  expect(body.requestId).toBeTruthy();
});

test("a shopper saves and lists an address", async ({ page }) => {
  await signUpFresh(page, "addr");
  const created = await apiJson(
    await page.request.post("/api/v1/account/addresses", { data: address }),
  );
  expect(created.status).toBe(201);
  expect(created.body.data).toMatchObject({
    isDefault: true,
    phone: "+919876543210",
  });

  const listed = await apiJson(
    await page.request.get("/api/v1/account/addresses"),
  );
  expect(listed.status).toBe(200);
  expect(listed.body.data).toHaveLength(1);

  const bad = await apiJson(
    await page.request.post("/api/v1/account/addresses", {
      data: { ...address, postalCode: "12345" },
    }),
  );
  expect(bad.status).toBe(400);
  expect(bad.body.error?.details).toHaveProperty("postalCode");

  const id = (created.body.data as { id: string }).id;
  const patched = await apiJson(
    await page.request.patch(`/api/v1/account/addresses/${id}`, {
      data: { city: "Margao" },
    }),
  );
  expect(patched.body.data).toMatchObject({ city: "Margao" });
  const removed = await page.request.delete(`/api/v1/account/addresses/${id}`);
  expect(removed.status()).toBe(200);
  const gone = await page.request.delete(`/api/v1/account/addresses/${id}`);
  expect(gone.status()).toBe(404);
});
