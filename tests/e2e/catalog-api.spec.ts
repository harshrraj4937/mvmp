import type { Page } from "@playwright/test";

import { readFileSync } from "node:fs";

import {
  apiJson,
  approvedMerchant,
  expect,
  grantAdminRole,
  newClientContext,
  onboardMerchant,
  signUpFresh,
  test,
} from "./helpers";

interface Product {
  id: string;
  images: { id: string; url: string }[];
  name: string;
  priceFromPaise: null | number;
  status: string;
  variants: {
    available: number;
    id: string;
    label: null | string;
    sku: string;
  }[];
}

const png = readFileSync("tests/fixtures/images/pixel.png");

const unique = () =>
  `${Date.now()}${Math.random().toString(36).slice(2, 6)}`.toUpperCase();

async function createProduct(page: Page): Promise<Product> {
  const created = await apiJson(
    await page.request.post("/api/v1/merchant/products", {
      data: productBody(),
    }),
  );
  expect(created.status).toBe(201);
  return created.body.data as Product;
}

function productBody(price = "₹1,299") {
  return {
    categoryId: "cat_handmade_gifts",
    initialStock: 4,
    name: `Brass diya ${unique()}`,
    variant: {
      heightMm: "60",
      lengthMm: "120",
      price,
      sku: `DIYA-${unique()}`,
      weightGrams: "450",
      widthMm: "120",
    },
  };
}

async function uploadPng(page: Page, productId: string) {
  return apiJson(
    await page.request.post(`/api/v1/merchant/products/${productId}/images`, {
      multipart: {
        alt: "Brass diya, lit",
        file: { buffer: png, mimeType: "image/png", name: "diya.png" },
      },
    }),
  );
}

test("catalog routes need a signed-in merchant with an approved shop", async ({
  page,
}) => {
  expect((await page.request.get("/api/v1/merchant/products")).status()).toBe(
    401,
  );
  await signUpFresh(page, "nocat");
  const noShop = await apiJson(
    await page.request.get("/api/v1/merchant/products"),
  );
  expect(noShop).toMatchObject({
    body: { error: { message: "You do not have a shop yet." } },
    status: 403,
  });
  await onboardMerchant(page);
  const draft = await apiJson(
    await page.request.post("/api/v1/merchant/products", {
      data: productBody(),
    }),
  );
  expect(draft).toMatchObject({
    body: {
      error: { message: "Your shop must be approved to manage products." },
    },
    status: 403,
  });
});

test("an approved merchant builds, stocks and publishes a product", async ({
  browser,
  page,
}) => {
  await approvedMerchant(browser, page, `Diya House ${unique()}`);
  const product = await createProduct(page);
  expect(product).toMatchObject({ priceFromPaise: 129_900, status: "DRAFT" });

  const defaultId = product.variants[0]?.id;
  expect(
    (
      await page.request.patch(
        `/api/v1/merchant/products/${product.id}/variants/${defaultId}`,
        {
          data: { label: "Small" },
        },
      )
    ).status(),
  ).toBe(200);
  const added = await apiJson(
    await page.request.post(
      `/api/v1/merchant/products/${product.id}/variants`,
      {
        data: {
          ...productBody("899").variant,
          initialStock: "2",
          label: "Large",
        },
      },
    ),
  );
  expect(added.status).toBe(201);
  expect((added.body.data as Product).priceFromPaise).toBe(89_900);

  const early = await apiJson(
    await page.request.post(`/api/v1/merchant/products/${product.id}/publish`),
  );
  expect(early).toMatchObject({
    body: {
      error: { code: "not_publishable", details: { missing: ["image"] } },
    },
    status: 409,
  });

  const image = await uploadPng(page, product.id);
  expect(image.status).toBe(201);
  const imageUrl = (image.body.data as { url: string }).url;
  const served = await page.request.get(imageUrl);
  expect(served.status()).toBe(200);
  expect(served.headers()).toMatchObject({
    "content-type": "image/png",
    "x-content-type-options": "nosniff",
  });

  const plus = await apiJson(
    await page.request.post(
      `/api/v1/merchant/variants/${defaultId}/stock-adjustments`,
      {
        data: { delta: "5", reason: "RESTOCK" },
      },
    ),
  );
  expect(plus.status).toBe(200);
  expect((plus.body.data as { available: number }).available).toBe(9);
  const minus = await apiJson(
    await page.request.post(
      `/api/v1/merchant/variants/${defaultId}/stock-adjustments`,
      {
        data: { delta: "-999", reason: "CORRECTION" },
      },
    ),
  );
  expect(minus).toMatchObject({
    body: { error: { code: "insufficient_stock" } },
    status: 409,
  });
  const movements = await apiJson(
    await page.request.get(
      `/api/v1/merchant/variants/${defaultId}/stock-movements`,
    ),
  );
  expect(
    (movements.body.data as { reason: string }[]).map((m) => m.reason),
  ).toEqual(["RESTOCK", "INITIAL"]);

  const published = await apiJson(
    await page.request.post(`/api/v1/merchant/products/${product.id}/publish`),
  );
  expect(published.status).toBe(200);
  expect((published.body.data as Product).status).toBe("PUBLISHED");

  const listed = await apiJson(
    await page.request.get("/api/v1/merchant/products?status=PUBLISHED"),
  );
  expect((listed.body.data as { id: string }[]).map((p) => p.id)).toEqual([
    product.id,
  ]);
  const badStatus = await apiJson(
    await page.request.get("/api/v1/merchant/products?status=LIVE"),
  );
  expect(badStatus).toMatchObject({
    body: { error: { code: "validation_failed" } },
    status: 400,
  });
});

test("images are checked by their bytes and uploads must be multipart", async ({
  browser,
  page,
}) => {
  await approvedMerchant(browser, page, `Byte Check ${unique()}`);
  const product = await createProduct(page);
  const disguised = await apiJson(
    await page.request.post(`/api/v1/merchant/products/${product.id}/images`, {
      multipart: {
        file: {
          buffer: Buffer.from("just some text"),
          mimeType: "image/jpeg",
          name: "photo.jpg",
        },
      },
    }),
  );
  expect(disguised).toMatchObject({
    body: { error: { code: "invalid_image" } },
    status: 400,
  });
  const json = await apiJson(
    await page.request.post(`/api/v1/merchant/products/${product.id}/images`, {
      data: { file: "nope" },
    }),
  );
  expect(json).toMatchObject({
    body: { error: { code: "validation_failed" } },
    status: 400,
  });
});

test("another shop cannot see or change a product", async ({
  browser,
  page,
}) => {
  await approvedMerchant(browser, page, `Owner ${unique()}`);
  const product = await createProduct(page);
  const image = (await uploadPng(page, product.id)).body.data as { id: string };
  const variantId = product.variants[0]?.id;

  const context = await newClientContext(browser);
  const other = await context.newPage();
  await approvedMerchant(browser, other, `Rival ${unique()}`);
  const base = `/api/v1/merchant/products/${product.id}`;
  const attempts = [
    other.request.get(base),
    other.request.patch(base, { data: { name: "Stolen diya" } }),
    other.request.post(`${base}/publish`),
    other.request.post(
      `/api/v1/merchant/variants/${variantId}/stock-adjustments`,
      {
        data: { delta: "-1", reason: "DAMAGED" },
      },
    ),
    other.request.delete(`${base}/images/${image.id}`),
  ];
  for (const attempt of attempts) {
    expect((await attempt).status()).toBe(404);
  }
  await context.close();

  const mine = await apiJson(await page.request.get(base));
  expect(mine.body.data).toMatchObject({
    images: [{ id: image.id }],
    name: product.name,
    variants: [{ available: 4 }],
  });
});

test("an admin hold blocks republishing; non-admins cannot hold", async ({
  browser,
  page,
}) => {
  await approvedMerchant(browser, page, `Held ${unique()}`);
  const product = await createProduct(page);
  await uploadPng(page, product.id);
  expect(
    (
      await page.request.post(`/api/v1/merchant/products/${product.id}/publish`)
    ).status(),
  ).toBe(200);

  const notAdmin = await page.request.post(
    `/api/v1/admin/products/${product.id}/unpublish`,
    {
      data: { reason: "I am not an admin." },
    },
  );
  expect(notAdmin.status()).toBe(403);

  const context = await newClientContext(browser);
  const admin = await context.newPage();
  grantAdminRole(await signUpFresh(admin, "holdadmin"));
  const shortReason = await apiJson(
    await admin.request.post(`/api/v1/admin/products/${product.id}/unpublish`, {
      data: { reason: "no" },
    }),
  );
  expect(shortReason.status).toBe(400);
  const held = await apiJson(
    await admin.request.post(`/api/v1/admin/products/${product.id}/unpublish`, {
      data: { reason: "Photos show another item." },
    }),
  );
  expect(held.body.data).toMatchObject({
    adminHoldReason: "Photos show another item.",
    status: "UNPUBLISHED",
  });
  const listed = await apiJson(
    await admin.request.get("/api/v1/admin/products?status=UNPUBLISHED"),
  );
  expect((listed.body.data as { id: string }[]).map((p) => p.id)).toContain(
    product.id,
  );

  const republish = await apiJson(
    await page.request.post(`/api/v1/merchant/products/${product.id}/publish`),
  );
  expect(republish).toMatchObject({
    body: { error: { code: "admin_hold" } },
    status: 409,
  });

  expect(
    (
      await admin.request.post(`/api/v1/admin/products/${product.id}/release`)
    ).status(),
  ).toBe(200);
  await context.close();
  expect(
    (
      await page.request.post(`/api/v1/merchant/products/${product.id}/publish`)
    ).status(),
  ).toBe(200);
});

test("a suspended shop's member is refused", async ({ browser, page }) => {
  const { shopId } = await approvedMerchant(
    browser,
    page,
    `Paused ${unique()}`,
  );
  const product = await createProduct(page);

  const context = await newClientContext(browser);
  const admin = await context.newPage();
  grantAdminRole(await signUpFresh(admin, "suspadmin"));
  expect(
    (
      await admin.request.post(`/api/v1/admin/merchants/${shopId}/suspend`)
    ).status(),
  ).toBe(200);
  await context.close();

  for (const response of [
    await page.request.get("/api/v1/merchant/products"),
    await page.request.get(`/api/v1/merchant/products/${product.id}`),
    await page.request.post(`/api/v1/merchant/products/${product.id}/archive`),
  ]) {
    expect(response.status()).toBe(403);
  }
});
