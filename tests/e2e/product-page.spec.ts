import type { Browser, Page } from "@playwright/test";

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

interface Created {
  id: string;
  slug: string;
  variants: { id: string }[];
}

interface Listing {
  composition: string;
  description: string;
  name: string;
}

/** A product with 250 g, 500 g and a sold-out 1 kg size. Not yet published. */
async function draftWithSizes(page: Page, listing: Listing): Promise<Created> {
  const created = await apiJson(
    await page.request.post("/api/v1/merchant/products", {
      data: {
        ...productStory(),
        ...listing,
        categoryId: "cat_snacks_and_sweets",
        initialStock: 4,
        variant: {
          heightMm: "60",
          lengthMm: "120",
          price: "₹499",
          sku: `PDP-${unique()}`,
          weightGrams: "450",
          widthMm: "120",
        },
      },
    }),
  );
  expect(created.status).toBe(201);
  const product = created.body.data as Created;
  const first = product.variants[0]?.id ?? "";
  expect(
    (
      await page.request.patch(
        `/api/v1/merchant/products/${product.id}/variants/${first}`,
        { data: { label: "250 g" } },
      )
    ).status(),
  ).toBe(200);
  for (const [label, price, stock] of [
    ["500 g", "899", "5"],
    ["1 kg", "1499", "0"],
  ] as const) {
    const added = await page.request.post(
      `/api/v1/merchant/products/${product.id}/variants`,
      {
        data: {
          heightMm: "60",
          initialStock: stock,
          label,
          lengthMm: "120",
          price,
          sku: `PDP-${unique()}`,
          weightGrams: "450",
          widthMm: "120",
        },
      },
    );
    expect(added.status()).toBe(201);
  }
  return product;
}

/** Opens a product from the explore grid, so the shop's slug is the one the grid links to. */
async function openFromExplore(
  browser: Browser,
  name: string,
): Promise<{
  shopper: Page;
  url: string;
  visitor: { close: () => Promise<void> };
}> {
  const visitor = await newClientContext(browser);
  const shopper = await visitor.newPage();
  await shopper.goto(`/explore?q=${encodeURIComponent(name)}`);
  await shopper.getByRole("link", { name }).first().click();
  await expect(shopper.getByRole("heading", { level: 1, name })).toBeVisible();
  return { shopper, url: shopper.url(), visitor };
}

async function publish(page: Page, product: Created): Promise<void> {
  const image = await page.request.post(
    `/api/v1/merchant/products/${product.id}/images`,
    {
      multipart: {
        alt: "Kokum candy, packed",
        file: { buffer: png, mimeType: "image/png", name: "candy.png" },
      },
    },
  );
  expect(image.status()).toBe(201);
  expect(
    (
      await page.request.post(`/api/v1/merchant/products/${product.id}/publish`)
    ).status(),
  ).toBe(200);
}

test("a shopper opens a product, picks a size and adds it to the cart", async ({
  browser,
  page,
}) => {
  const tag = unique();
  const name = `Kokum candy ${tag}`;
  await approvedMerchant(browser, page, `Malvan Kitchen ${tag}`);
  const product = await draftWithSizes(page, {
    composition: "Kokum, jaggery",
    description: "Sun dried in the courtyard.\n\nPacked by hand.",
    name,
  });
  await publish(page, product);

  const { shopper, visitor } = await openFromExplore(browser, name);
  await expect(shopper.getByText("Homemade", { exact: true })).toBeVisible();
  await expect(shopper.getByText("From Malvan, Maharashtra")).toBeVisible();
  await expect(
    shopper.getByText("Made by Lakshmi Sawant and her daughters"),
  ).toBeVisible();
  await expect(
    shopper.getByRole("heading", { level: 2, name: "Ingredients" }),
  ).toBeVisible();
  await expect(shopper.getByText("Packed by hand.")).toBeVisible();

  await expect(shopper.getByLabel(/1 kg/)).toBeDisabled();
  await shopper.getByLabel(/500 g/).check();
  await shopper.locator("#quantity").fill("2");
  await shopper.getByRole("button", { name: "Add to cart" }).click();
  await expect(shopper.getByRole("status")).toContainText("Added to cart");
  await expect(shopper.locator(".cart-count")).toHaveText("2");

  await visitor.close();
});

test("unknown and unpublished products are 404, and the starter products page is gone", async ({
  browser,
  page,
}) => {
  const tag = unique();
  await approvedMerchant(browser, page, `Draft Kitchen ${tag}`);
  const published = await draftWithSizes(page, {
    composition: "Kokum",
    description: "Sun dried.",
    name: `Live candy ${tag}`,
  });
  await publish(page, published);
  const draft = await draftWithSizes(page, {
    composition: "Kokum",
    description: "Sun dried.",
    name: `Draft candy ${tag}`,
  });

  const { shopper, url, visitor } = await openFromExplore(
    browser,
    `Live candy ${tag}`,
  );
  const shopPath = new URL(url).pathname.split("/").slice(0, 3).join("/");
  expect((await shopper.goto(`${shopPath}/${draft.slug}`))?.status()).toBe(404);
  expect((await shopper.goto(`${shopPath}/nope-${tag}`))?.status()).toBe(404);
  expect((await shopper.goto("/products"))?.status()).toBe(404);
  await visitor.close();
});

test("composition text renders as text, never as markup", async ({
  browser,
  page,
}) => {
  const tag = unique();
  const name = `Risky candy ${tag}`;
  await approvedMerchant(browser, page, `Plain Kitchen ${tag}`);
  const product = await draftWithSizes(page, {
    composition: "<script>alert(1)</script>",
    description: "Plain text.",
    name,
  });
  await publish(page, product);

  const { shopper, visitor } = await openFromExplore(browser, name);
  await expect(shopper.getByText("<script>alert(1)</script>")).toBeVisible();
  await expect(shopper.locator("script", { hasText: "alert(1)" })).toHaveCount(
    0,
  );
  await visitor.close();
});
