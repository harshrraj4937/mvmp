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

/** A published Goa product, so the Goa region is live and the newest card is real. */
async function publishGoaProduct(page: Page, name: string): Promise<void> {
  const created = await apiJson(
    await page.request.post("/api/v1/merchant/products", {
      data: {
        ...productStory(),
        categoryId: "cat_snacks_and_sweets",
        initialStock: 4,
        name,
        originPlace: "Mapusa",
        originState: "goa",
        variant: {
          heightMm: "60",
          lengthMm: "120",
          price: "₹349",
          sku: `LAND-${unique()}`,
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
}

test("landing page renders every section without demo wording", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "From our roots,",
  );
  for (const id of [
    "discover",
    "celebrations",
    "our-story",
    "sell",
    "early-access",
  ]) {
    await expect(page.locator(`#${id}`)).toBeVisible();
  }
  await expect(page.getByText(/demo store/i)).toHaveCount(0);
  await expect(
    page.locator('a[href*="shop.html"], a[href*="gillu-merchant-html"]'),
  ).toHaveCount(0);
});

test("festival tabs work with the keyboard", async ({ page }) => {
  await page.goto("/");
  const onam = page.getByRole("tab", { name: /Onam/ });
  await onam.click();
  await expect(onam).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("#festival-panel")).toContainText(
    "A carpet of flowers.",
  );
  await page.keyboard.press("ArrowRight");
  const pongal = page.getByRole("tab", { name: /Pongal/ });
  await expect(pongal).toBeFocused();
  await expect(pongal).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("#festival-panel")).toContainText("New harvest.");
});

test("early access collects nothing; Start selling goes to onboarding", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Be part of the beginning/ }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText(
    "No contact information is being collected",
  );
  await expect(dialog.locator("input, textarea, select")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await page
    .locator("#sell")
    .getByRole("link", { name: /Start selling/ })
    .click();
  await expect(page).toHaveURL(
    /\/auth\/sign-in\?next=%2Fmerchant%2Fonboarding$/,
  );
});

test("phone width: no horizontal scroll and the mobile nav closes after a choice", async ({
  page,
}) => {
  await page.setViewportSize({ height: 780, width: 360 });
  await page.goto("/");
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(360);
  await page.getByRole("button", { name: "Open navigation" }).click();
  const nav = page.locator("#mobile-nav");
  await expect(nav).toBeVisible();
  await nav.getByRole("link", { name: "Discover" }).click();
  await expect(nav).toBeHidden();
});

test("published products replace the previews, and the region links to explore", async ({
  browser,
  page,
}) => {
  const tag = unique();
  const name = `Landing candy ${tag}`;
  await approvedMerchant(browser, page, `Landing Kitchen ${tag}`);
  await publishGoaProduct(page, name);

  const visitor = await newClientContext(browser);
  const shopper = await visitor.newPage();
  await shopper.goto("/");
  await expect(shopper.getByRole("link", { name })).toBeVisible();
  await expect(shopper.getByText("Illustrative imagery")).toHaveCount(0);
  await expect(
    shopper.getByRole("link", { name: "Explore everything" }),
  ).toHaveAttribute("href", "/explore");
  await expect(shopper.locator('a[href="/explore?region=goa"]')).toBeVisible();
  await expect(
    shopper.getByRole("link", { name: "Explore the collection" }),
  ).toHaveAttribute("href", "/explore");
  await visitor.close();
});
