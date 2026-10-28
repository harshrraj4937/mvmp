import type { Page } from "@playwright/test";

import { readFileSync } from "node:fs";

import {
  apiJson,
  approvedMerchant,
  expect,
  newClientContext,
  productStory,
  test,
} from "./helpers";

const png = readFileSync("tests/fixtures/images/pixel.png");

const unique = () =>
  `${Date.now()}${Math.random().toString(36).slice(2, 6)}`.toUpperCase();

/** A published product in stock; returns its default variant id. */
async function publishedVariant(page: Page): Promise<string> {
  const created = await apiJson(
    await page.request.post("/api/v1/merchant/products", {
      data: {
        ...productStory(),
        categoryId: "cat_handmade_gifts",
        initialStock: 4,
        name: `Cart diya ${unique()}`,
        variant: {
          heightMm: "60",
          lengthMm: "120",
          price: "₹499",
          sku: `CART-${unique()}`,
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
  const image = await page.request.post(
    `/api/v1/merchant/products/${product.id}/images`,
    {
      multipart: {
        alt: "Cart diya",
        file: { buffer: png, mimeType: "image/png", name: "diya.png" },
      },
    },
  );
  expect(image.status()).toBe(201);
  const published = await page.request.post(
    `/api/v1/merchant/products/${product.id}/publish`,
  );
  expect(published.status()).toBe(200);
  return product.variants[0]?.id ?? "";
}

test("a guest adds to the cart, gets the cookie, and reads it back", async ({
  browser,
  page,
}) => {
  await approvedMerchant(browser, page, `Cart House ${unique()}`);
  const variantId = await publishedVariant(page);

  const context = await newClientContext(browser);
  const guest = context.request;

  const added = await guest.post("/api/v1/cart/items", {
    data: { quantity: 1, variantId },
  });
  expect(added.status()).toBe(201);
  const setCookie = added.headers()["set-cookie"] ?? "";
  expect(setCookie).toContain("gillu_cart=");
  expect(setCookie).toMatch(/HttpOnly/i);
  expect(setCookie).toMatch(/SameSite=Lax/i);
  expect(added.headers()["cache-control"]).toBe("no-store");
  const addedBody = (await added.json()) as {
    data: { count: number };
  };
  expect(addedBody.data.count).toBe(1);

  const read = await guest.get("/api/v1/cart");
  expect(read.status()).toBe(200);
  expect(read.headers()["cache-control"]).toBe("no-store");
  const readBody = (await read.json()) as {
    data: { groups: { lines: { variantId: string }[] }[] };
  };
  expect(readBody.data.groups[0]?.lines[0]?.variantId).toBe(variantId);
  await context.close();
});

test("a non-JSON cart body is a 400", async ({ browser, page }) => {
  await approvedMerchant(browser, page, `Cart Text ${unique()}`);
  const context = await newClientContext(browser);
  const response = await context.request.post("/api/v1/cart/items", {
    data: "quantity=1",
    headers: { "content-type": "text/plain" },
  });
  expect(response.status()).toBe(400);
  expect(
    ((await response.json()) as { error: { code: string } }).error.code,
  ).toBe("validation_failed");
  await context.close();
});
