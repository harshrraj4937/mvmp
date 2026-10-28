import type { Page } from "@playwright/test";

import { readFileSync } from "node:fs";

import {
  apiJson,
  approvedMerchant,
  expect,
  fillFields,
  newClientContext,
  productStory,
  test,
} from "./helpers";

const png = readFileSync("tests/fixtures/images/pixel.png");

const unique = () =>
  `${Date.now()}${Math.random().toString(36).slice(2, 6)}`.toUpperCase();

/** A published product in stock. Returns its id and its one variant's id. */
async function publishOne(
  page: Page,
  name: string,
  price: string,
): Promise<{ productId: string; variantId: string }> {
  const created = await apiJson(
    await page.request.post("/api/v1/merchant/products", {
      data: {
        ...productStory(),
        categoryId: "cat_snacks_and_sweets",
        initialStock: 4,
        name,
        variant: {
          heightMm: "60",
          lengthMm: "120",
          price,
          sku: `CC-${unique()}`,
          weightGrams: "450",
          widthMm: "120",
        },
      },
    }),
  );
  expect(created.status).toBe(201);
  const product = created.body.data as {
    id: string;
    variants: { id: string }[];
  };
  expect(
    (
      await page.request.post(
        `/api/v1/merchant/products/${product.id}/images`,
        {
          multipart: {
            alt: name,
            file: { buffer: png, mimeType: "image/png", name: "item.png" },
          },
        },
      )
    ).status(),
  ).toBe(201);
  expect(
    (
      await page.request.post(`/api/v1/merchant/products/${product.id}/publish`)
    ).status(),
  ).toBe(200);
  return { productId: product.id, variantId: product.variants[0]?.id ?? "" };
}

test("a guest's cart survives sign-in and reaches checkout", async ({
  browser,
  page,
}) => {
  const tag = unique();
  const storeA = `Cart Shop A ${tag}`;
  const storeB = `Cart Shop B ${tag}`;
  const nameA = `Goa candy ${tag}`;
  const nameB = `Jaipur print ${tag}`;

  await approvedMerchant(browser, page, storeA);
  const itemA = await publishOne(page, nameA, "₹349");

  const merchantB = await newClientContext(browser);
  const pageB = await merchantB.newPage();
  await approvedMerchant(browser, pageB, storeB);
  const itemB = await publishOne(pageB, nameB, "₹899");
  await merchantB.close();

  const visitor = await newClientContext(browser);
  const api = visitor.request;
  const shopper = await visitor.newPage();

  expect(
    (
      await api.post("/api/v1/cart/items", {
        data: { quantity: 2, variantId: itemA.variantId },
      })
    ).status(),
  ).toBe(201);
  expect(
    (
      await api.post("/api/v1/cart/items", {
        data: { quantity: 1, variantId: itemB.variantId },
      })
    ).status(),
  ).toBe(201);

  await shopper.goto("/cart");
  await expect(
    shopper.getByRole("heading", { level: 1, name: "Your cart" }),
  ).toBeVisible();
  await expect(
    shopper.getByRole("heading", { level: 2, name: storeA }),
  ).toBeVisible();
  await expect(
    shopper.getByRole("heading", { level: 2, name: storeB }),
  ).toBeVisible();
  await expect(shopper.getByText("₹1,597")).toBeVisible();

  await shopper
    .getByRole("button", { name: `Increase quantity of ${nameA}` })
    .click();
  await expect(shopper.getByText("3", { exact: true })).toBeVisible();
  await shopper
    .getByRole("button", { name: `Decrease quantity of ${nameA}` })
    .click();
  await expect(shopper.locator("[aria-live=polite]").first()).toHaveText("2");
  await shopper.getByRole("button", { name: `Remove ${nameB}` }).click();
  await expect(
    shopper.getByRole("heading", { level: 2, name: storeB }),
  ).toHaveCount(0);
  await expect(shopper.getByText("₹698", { exact: true })).toBeVisible();

  const restock = (delta: number, reason: string) =>
    page.request.post(
      `/api/v1/merchant/variants/${itemA.variantId}/stock-adjustments`,
      { data: { delta, reason } },
    );
  expect((await restock(-3, "DAMAGED")).status()).toBe(200);
  await shopper.reload();
  await expect(
    shopper.getByText("Only 1 left — lower the quantity"),
  ).toBeVisible();
  await expect(
    shopper.getByRole("button", { name: "Checkout" }),
  ).toBeDisabled();
  await expect(
    shopper.getByText("Fix the items marked above to continue."),
  ).toBeVisible();

  expect((await restock(3, "RESTOCK")).status()).toBe(200);
  await shopper.reload();
  await shopper.getByRole("link", { name: "Checkout" }).click();
  await expect(shopper).toHaveURL(/\/auth\/sign-in\?next=%2Fcheckout/);

  await shopper
    .getByRole("main")
    .getByRole("link", { name: "Sign up" })
    .click();
  await fillFields([
    [shopper.locator("#name"), "Gillu Tester"],
    [shopper.locator("#email"), `cart-${tag.toLowerCase()}@e2e.gillu.test`],
    [shopper.locator("#password"), "Correct-Horse-9-Battery"],
  ]);
  await shopper.locator("form button[type=submit]").click();
  await shopper.waitForURL(/\/checkout$/);

  await expect(
    shopper.getByRole("heading", { level: 1, name: "Checkout" }),
  ).toBeVisible();
  await expect(shopper.getByText(nameA)).toBeVisible();
  await expect(
    shopper.getByRole("heading", { name: "Deliver to" }),
  ).toBeVisible();

  // The header's cart fetch on this page already cleared the guest cookie.
  await expect
    .poll(async () =>
      (await visitor.cookies()).some((cookie) => cookie.name === "gillu_cart"),
    )
    .toBe(false);
  const after = await api.get("/api/v1/cart");
  expect(after.status()).toBe(200);
  const body = (await after.json()) as {
    data: { count: number; groups: { lines: { quantity: number }[] }[] };
  };
  expect(body.data.count).toBe(2);
  expect(body.data.groups[0]?.lines[0]?.quantity).toBe(2);

  await visitor.close();
});

test("the sign-in and sign-up pages show no template cart with sample items", async ({
  page,
}) => {
  for (const path of ["/auth/sign-in?next=%2Fcheckout", "/auth/sign-up"]) {
    await page.goto(path);
    await expect(page.getByRole("button", { name: "Open cart" })).toHaveCount(
      0,
    );
    await expect(page.getByText("Premium Wireless Headphones")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Your cart" })).toHaveAttribute(
      "href",
      "/cart",
    );
  }
});
