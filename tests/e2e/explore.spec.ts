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

interface Listing {
  categoryId: string;
  composition: string;
  madeBy: string;
  madeHow: "HANDMADE" | "HOMEMADE";
  name: string;
  originPlace: string;
  originState: string;
}

/** Creates, illustrates and publishes one product as the signed-in merchant. */
async function publish(page: Page, listing: Listing): Promise<void> {
  const created = await apiJson(
    await page.request.post("/api/v1/merchant/products", {
      data: {
        ...productStory(),
        ...listing,
        initialStock: 4,
        variant: {
          heightMm: "60",
          lengthMm: "120",
          price: "₹349",
          sku: `EXP-${unique()}`,
          weightGrams: "450",
          widthMm: "120",
        },
      },
    }),
  );
  expect(created.status).toBe(201);
  const id = (created.body.data as { id: string }).id;
  const image = await page.request.post(
    `/api/v1/merchant/products/${id}/images`,
    {
      multipart: {
        alt: listing.name,
        file: { buffer: png, mimeType: "image/png", name: "item.png" },
      },
    },
  );
  expect(image.status()).toBe(201);
  expect(
    (
      await page.request.post(`/api/v1/merchant/products/${id}/publish`)
    ).status(),
  ).toBe(200);
}

/** Two approved shops with products in Goa and Rajasthan. */
async function seedMarket(browser: Browser, page: Page) {
  const tag = unique();
  const goa: Listing = {
    categoryId: "cat_snacks_and_sweets",
    composition: `Kokum and jaggery ${tag}`,
    madeBy: `Asha ${tag}`,
    madeHow: "HOMEMADE",
    name: `Goan kokum candy ${tag}`,
    originPlace: "Mapusa",
    originState: "goa",
  };
  const rajasthan: Listing = {
    categoryId: "cat_art_and_handicrafts",
    composition: `Block print ${tag}`,
    madeBy: `Ravi ${tag}`,
    madeHow: "HANDMADE",
    name: `Jaipur block print ${tag}`,
    originPlace: "Sanganer",
    originState: "rajasthan",
  };
  await approvedMerchant(browser, page, `Goa House ${tag}`);
  await publish(page, goa);
  const second = await newClientContext(browser);
  const other = await second.newPage();
  await approvedMerchant(browser, other, `Jaipur House ${tag}`);
  await publish(other, rajasthan);
  await second.close();
  return { goa, rajasthan };
}

test("explore filters, searches and pages the storefront", async ({
  browser,
  page,
}) => {
  const { goa, rajasthan } = await seedMarket(browser, page);
  const visitor = await newClientContext(browser);
  const shopper = await visitor.newPage();

  await shopper.goto("/explore");
  await expect(
    shopper.getByRole("heading", { name: "Explore Gillu" }),
  ).toBeVisible();

  await shopper.locator("#region").selectOption("goa");
  await shopper.waitForURL(/region=goa/);
  await expect(shopper.getByText(goa.name)).toBeVisible();
  await expect(shopper.getByText(rajasthan.name)).toHaveCount(0);

  await shopper.goto("/explore");
  await shopper.getByLabel("Handmade", { exact: true }).check();
  await shopper.waitForURL(/made=handmade/);
  await expect(shopper.getByText(rajasthan.name)).toBeVisible();
  await expect(shopper.getByText(goa.name)).toHaveCount(0);

  await shopper.goto("/explore");
  await shopper.locator("#category").selectOption("snacks-and-sweets");
  await shopper.waitForURL(/category=snacks-and-sweets/);
  await expect(shopper.getByText(goa.name)).toBeVisible();
  await expect(shopper.getByText(rajasthan.name)).toHaveCount(0);

  await shopper.goto("/explore");
  await shopper.getByLabel("Search").fill("kokum");
  await shopper.getByRole("button", { name: "Search" }).click();
  await expect(shopper.getByText(goa.name)).toBeVisible();
  await expect(shopper.getByText(rajasthan.name)).toHaveCount(0);

  const bad = await shopper.goto("/explore?page=-3&region=atlantis&sort=drop");
  expect(bad?.status()).toBe(200);
  await expect(shopper.getByText(goa.name)).toBeVisible();

  await shopper.goto("/explore");
  await shopper.getByLabel("Search").fill(`no such thing ${unique()}`);
  await shopper.getByRole("button", { name: "Search" }).click();
  await expect(
    shopper.getByText("Nothing here yet — try fewer filters."),
  ).toBeVisible();

  await expect(shopper.locator(".cart-count")).toHaveCount(0);

  await shopper.setViewportSize({ height: 800, width: 360 });
  await shopper.goto("/explore");
  const overflow = await shopper.evaluate(
    () => document.documentElement.scrollWidth,
  );
  expect(overflow).toBeLessThanOrEqual(360);

  await visitor.close();
});
