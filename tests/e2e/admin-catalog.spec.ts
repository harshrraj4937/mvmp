import type { Page } from "@playwright/test";

import { readFileSync } from "node:fs";

import {
  apiJson,
  approvedMerchant,
  expect,
  forgedAdminRscHeaders,
  grantAdminRole,
  newClientContext,
  productStory,
  signUpFresh,
  test,
} from "./helpers";

/** A published product of the merchant signed in on `page`; returns its id. */
async function publishedProduct(page: Page, name: string): Promise<string> {
  const created = await apiJson(
    await page.request.post("/api/v1/merchant/products", {
      data: {
        ...productStory(),
        categoryId: "cat_snacks_and_sweets",
        initialStock: 5,
        name,
        variant: {
          heightMm: 50,
          lengthMm: 150,
          price: "450",
          sku: `MOD-${Date.now()}`,
          weightGrams: 300,
          widthMm: 100,
        },
      },
    }),
  );
  const id = (created.body.data as { id: string }).id;
  await page.request.post(`/api/v1/merchant/products/${id}/images`, {
    multipart: {
      file: {
        buffer: readFileSync("tests/fixtures/images/pixel.png"),
        mimeType: "image/png",
        name: "pixel.png",
      },
    },
  });
  expect(
    (
      await page.request.post(`/api/v1/merchant/products/${id}/publish`)
    ).status(),
  ).toBe(200);
  return id;
}

test("an admin adds a category and hides it", async ({ page }) => {
  grantAdminRole(await signUpFresh(page, "catadmin"));
  const name = `Pickles and preserves ${Date.now()}`;

  await page.goto("/admin/categories");
  await page.getByLabel("New category").fill(name);
  await page.getByRole("button", { name: "Add category" }).click();
  await expect(page.getByLabel(`Name of ${name}`)).toHaveValue(name);

  await page.getByLabel("New category").fill(name.toUpperCase());
  await page.getByRole("button", { name: "Add category" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toHaveText(
    "A category with that name exists.",
  );

  await page.getByRole("button", { name: `Hide ${name}` }).click();
  await expect(
    page.getByRole("button", { name: `Show ${name}` }),
  ).toBeVisible();
  const active = await apiJson(await page.request.get("/api/v1/categories"));
  expect(
    (active.body.data as { name: string }[]).map((category) => category.name),
  ).not.toContain(name);
});

test("non-admins cannot manage categories", async ({ page }) => {
  await signUpFresh(page, "catuser");
  const response = await page.goto("/admin/categories");
  expect(response?.status()).toBe(404);

  // A forged RSC request must not stream the admin page either.
  const forged = await page.request.get("/admin/categories", {
    headers: forgedAdminRscHeaders(),
  });
  expect(forged.headers()["content-type"]).toContain("text/x-component");
  expect(await forged.text()).not.toContain("Add category");

  const list = await apiJson(
    await page.request.get("/api/v1/admin/categories"),
  );
  expect(list.status).toBe(403);
  const create = await apiJson(
    await page.request.post("/api/v1/admin/categories", {
      data: { name: "Sneaky" },
    }),
  );
  expect(create.status).toBe(403);
});

test("the public category list needs no session", async ({ request }) => {
  const result = await apiJson(await request.get("/api/v1/categories"));
  expect(result.status).toBe(200);
  expect((result.body.data as { name: string }[])[0]?.name).toBe(
    "Regional packaged food",
  );
});

test("an admin pauses a product and releases it", async ({ browser, page }) => {
  await approvedMerchant(browser, page, `Moderated ${Date.now()}`);
  const name = `Chakli tin ${Date.now()}`;
  const id = await publishedProduct(page, name);

  const context = await newClientContext(browser);
  const admin = await context.newPage();
  grantAdminRole(await signUpFresh(admin, "modadmin"));
  await admin.goto("/admin/products?status=PUBLISHED");
  await admin.getByRole("button", { name: `Pause ${name}` }).click();
  await admin.locator("#hold-reason").fill("Please add an ingredients list");
  await admin.getByRole("button", { name: "Confirm pause" }).click();
  await expect(admin.getByRole("row", { name: new RegExp(name) })).toHaveCount(
    0,
  );
  await admin.goto("/admin/products?status=UNPUBLISHED");
  const row = admin.getByRole("row", { name: new RegExp(name) });
  await expect(row).toContainText("Please add an ingredients list");

  await page.goto(`/merchant/products/${id}`);
  await expect(
    page.getByText(
      "Gillu has paused this product: Please add an ingredients list",
    ),
  ).toBeVisible();
  await page.getByRole("button", { name: "Publish" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Contact support",
  );
  await expect(
    page.locator(".badge", { hasText: "UNPUBLISHED" }),
  ).toBeVisible();

  await row.getByRole("button", { name: `Release ${name}` }).click();
  await expect(
    row.getByRole("button", { name: `Release ${name}` }),
  ).toHaveCount(0);
  await context.close();

  await page.reload();
  await expect(page.getByText(/Gillu has paused this product/)).toHaveCount(0);
  await page.getByRole("button", { name: "Publish" }).click();
  await expect(page.locator(".badge", { hasText: "PUBLISHED" })).toBeVisible();
});

test("non-admins cannot see product moderation", async ({ browser, page }) => {
  await approvedMerchant(browser, page, `Curious ${Date.now()}`);
  const name = `Secret laddoo ${Date.now()}`;
  await publishedProduct(page, name);

  const response = await page.goto("/admin/products");
  expect(response?.status()).toBe(404);
  expect(await page.content()).not.toContain(name);
  const forged = await page.request.get("/admin/products", {
    headers: forgedAdminRscHeaders(),
  });
  expect(forged.headers()["content-type"]).toContain("text/x-component");
  expect(await forged.text()).not.toContain(name);
});

test("an admin sets whether a category lists ingredients or materials", async ({
  page,
}) => {
  grantAdminRole(await signUpFresh(page, "labeladmin"));
  const name = `Clay and stone ${Date.now()}`;
  await page.goto("/admin/categories");
  await page.getByLabel("New category").fill(name);
  await page.getByRole("button", { name: "Add category" }).click();
  const label = page.getByLabel(`Ingredients or materials for ${name}`);
  await expect(label).toHaveValue("INGREDIENTS");
  const saved = page.waitForResponse(
    (response) =>
      response.url().includes("/api/v1/admin/categories/") &&
      response.request().method() === "PATCH",
  );
  await label.selectOption("MATERIALS");
  expect((await saved).status()).toBe(200);
  await page.reload();
  await expect(
    page.getByLabel(`Ingredients or materials for ${name}`),
  ).toHaveValue("MATERIALS");
});
