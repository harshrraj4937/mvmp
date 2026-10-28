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

const STORY_LINE = "We roast cashews in our courtyard kitchen by the sea.";

/** The shop slug of the signed-in merchant. */
async function ownSlug(page: Page): Promise<string> {
  const profile = await apiJson(
    await page.request.get("/api/v1/merchant/profile"),
  );
  return (profile.body.data as { slug: string }).slug;
}

/** One published product in stock. Returns its id. */
async function publishOne(page: Page, name: string): Promise<string> {
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
          price: "₹349",
          sku: `SHOP-${unique()}`,
          weightGrams: "450",
          widthMm: "120",
        },
      },
    }),
  );
  expect(created.status).toBe(201);
  const id = (created.body.data as { id: string }).id;
  expect(
    (
      await page.request.post(`/api/v1/merchant/products/${id}/images`, {
        multipart: {
          alt: name,
          file: { buffer: png, mimeType: "image/png", name: "item.png" },
        },
      })
    ).status(),
  ).toBe(201);
  expect(
    (
      await page.request.post(`/api/v1/merchant/products/${id}/publish`)
    ).status(),
  ).toBe(200);
  return id;
}

/** The `/shops/<slug>` path the explore grid links to for `productName`. */
async function shopPathFor(
  browser: Parameters<typeof newClientContext>[0],
  productName: string,
): Promise<string> {
  const context = await newClientContext(browser);
  const page = await context.newPage();
  await page.goto(`/explore?q=${encodeURIComponent(productName)}`);
  const href = await page
    .getByRole("link", { name: productName })
    .first()
    .getAttribute("href");
  await context.close();
  return (href ?? "").split("/").slice(0, 3).join("/");
}

test("a first visit reads the story; a returning visit folds it into a strip", async ({
  browser,
  page,
}) => {
  const tag = unique();
  const storeName = `Story Kitchen ${tag}`;
  const productName = `Shop candy ${tag}`;
  await approvedMerchant(browser, page, storeName);
  await publishOne(page, productName);
  const shopPath = await shopPathFor(browser, productName);

  const visitor = await newClientContext(browser);
  const shopper = await visitor.newPage();
  await shopper.goto(shopPath);
  await expect(
    shopper.getByRole("heading", { level: 1, name: storeName }),
  ).toBeVisible();
  await expect(shopper.getByText(STORY_LINE)).toBeVisible();
  await expect(shopper.locator(".shop-photos img").first()).toBeAttached();
  await expect(
    shopper.getByRole("heading", { level: 2, name: `From ${storeName}` }),
  ).toBeVisible();
  await expect(shopper.getByText(productName)).toBeVisible();

  await shopper.reload();
  const strip = shopper.getByRole("button", { name: "Read their story" });
  await expect(strip).toHaveAttribute("aria-expanded", "false");
  await expect(shopper.getByText(STORY_LINE)).toHaveCount(0);
  await strip.click();
  await expect(strip).toHaveAttribute("aria-expanded", "true");
  await expect(shopper.getByText(STORY_LINE)).toBeVisible();

  await shopper.getByRole("link", { name: "Skip to products" }).click();
  await expect(shopper.locator("#products")).toBeInViewport();

  await visitor.close();
});

test("a shop with an incomplete story is not found", async ({
  browser,
  page,
}) => {
  await approvedMerchant(browser, page, `Bare Kitchen ${unique()}`, {
    story: false,
  });
  const slug = await ownSlug(page);
  const visitor = await newClientContext(browser);
  const shopper = await visitor.newPage();
  expect((await shopper.goto(`/shops/${slug}`))?.status()).toBe(404);
  await visitor.close();
});

test("a shop with no products on sale says so", async ({ browser, page }) => {
  const tag = unique();
  const productName = `Gone candy ${tag}`;
  await approvedMerchant(browser, page, `Quiet Stock ${tag}`);
  const productId = await publishOne(page, productName);
  const shopPath = await shopPathFor(browser, productName);
  expect(
    (
      await page.request.post(
        `/api/v1/merchant/products/${productId}/unpublish`,
      )
    ).status(),
  ).toBe(200);

  const visitor = await newClientContext(browser);
  const shopper = await visitor.newPage();
  await shopper.goto(shopPath);
  await expect(shopper.getByText("New finds coming soon.")).toBeVisible();
  await visitor.close();
});

test("a long unbroken word does not scroll the shop page sideways", async ({
  browser,
  page,
}) => {
  const tag = unique();
  const productName = `Wide candy ${tag}`;
  await approvedMerchant(browser, page, `Wide Kitchen ${tag}`);
  await publishOne(page, productName);
  const shopPath = await shopPathFor(browser, productName);

  const visitor = await newClientContext(browser);
  const shopper = await visitor.newPage();
  await shopper.setViewportSize({ height: 800, width: 360 });
  await shopper.goto(shopPath);
  const overflow = await shopper.evaluate(
    () => document.documentElement.scrollWidth,
  );
  expect(overflow).toBeLessThanOrEqual(360);
  await visitor.close();
});
