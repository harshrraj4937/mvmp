import type { Page } from "@playwright/test";

import {
  approvedMerchant,
  expect,
  fillFields,
  onboardMerchant,
  signUpFresh,
  test,
} from "./helpers";

const unique = () => Math.random().toString(36).slice(2, 8).toUpperCase();

interface Draft {
  initialStock?: string;
  mrp?: string;
  name: string;
  price?: string;
}

/** Fills the new-product form and saves it as a draft. */
async function saveDraft(page: Page, draft: Draft) {
  await page.goto("/merchant/products/new");
  await expect(
    page.getByRole("heading", { name: "Add to your collection." }),
  ).toBeVisible();
  await page
    .locator("#categoryId")
    .selectOption({ label: "Snacks and sweets" });
  await fillFields([
    [page.locator("#name"), draft.name],
    [
      page.locator("#description"),
      "Whole W240 cashews roasted with rock salt.",
    ],
    [page.locator("#price"), draft.price ?? "1,299"],
    [page.locator("#mrp"), draft.mrp ?? "1499"],
    [page.locator("#sku"), `kk-kaju-${unique()}`],
    [page.locator("#weightGrams"), "520"],
    [page.locator("#lengthMm"), "220"],
    [page.locator("#widthMm"), "160"],
    [page.locator("#heightMm"), "60"],
    [page.locator("#initialStock"), draft.initialStock ?? "12"],
  ]);
  await page.getByRole("button", { name: "Save draft" }).click();
}

async function uploadPixel(page: Page) {
  await page
    .locator("#imageFile")
    .setInputFiles("tests/fixtures/images/pixel.png");
  await page.getByRole("button", { name: "Upload image" }).click();
  await expect(page.locator(".product-images img")).toHaveCount(1);
}

test("an approved merchant creates, stocks, illustrates and publishes a product", async ({
  browser,
  page,
}) => {
  await approvedMerchant(browser, page, `Kaju Katli Co ${unique()}`);
  await page.goto("/merchant/products");
  await expect(
    page.getByRole("heading", { name: "The things you make." }),
  ).toBeVisible();
  await expect(page.getByText("Nothing in this collection yet.")).toBeVisible();
  await page.getByRole("link", { name: "Add a product" }).first().click();
  await expect(page).toHaveURL(/\/merchant\/products\/new$/);

  const name = `Roasted cashews ${unique()}`;
  await saveDraft(page, { name });
  await expect(page).toHaveURL(/\/merchant\/products\/[a-z0-9]+$/);
  await expect(
    page.getByRole("heading", { name: "A little product polish." }),
  ).toBeVisible();
  await expect(page.locator(".badge", { hasText: "DRAFT" })).toBeVisible();
  const blockers = page.getByRole("list", { name: "Before you can publish:" });
  await expect(blockers).toContainText("Add at least one image");

  await uploadPixel(page);
  await expect(blockers).toHaveCount(0);
  await page.getByRole("button", { name: "Publish" }).click();
  await expect(page.locator(".badge", { hasText: "PUBLISHED" })).toBeVisible();

  await page.goto("/merchant/products");
  const card = page.locator(".product-card", { hasText: name });
  await expect(card).toContainText("₹1,299");
  await expect(card).toContainText("12 in stock");

  await page.locator("#productSearch").fill("no such thing");
  await page.locator("#productSearch").press("Enter");
  await expect(page.getByText("No products match your search.")).toBeVisible();
});

test("variants and stock", async ({ browser, page }) => {
  await approvedMerchant(browser, page, `Mithai Ghar ${unique()}`);
  const name = `Kaju katli ${unique()}`;
  await saveDraft(page, { name });
  await expect(
    page.getByRole("heading", { name: "A little product polish." }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Add variant" }).click();
  const dialog = page.getByRole("dialog");
  await fillFields([
    [dialog.locator("#existingLabel"), "500 g"],
    [dialog.locator("#variantLabel"), "250 g"],
    [dialog.locator("#variantPrice"), "699"],
    [dialog.locator("#variantSku"), `kk-250-${unique()}`],
    [dialog.locator("#variantWeightGrams"), "260"],
    [dialog.locator("#variantLengthMm"), "160"],
    [dialog.locator("#variantWidthMm"), "120"],
    [dialog.locator("#variantHeightMm"), "50"],
    [dialog.locator("#variantInitialStock"), "3"],
  ]);
  await dialog.getByRole("button", { name: "Add variant" }).click();
  const row = page.getByRole("row", { name: /250 g/ });
  await expect(row).toContainText("3");
  await expect(page.getByRole("row", { name: /500 g/ })).toContainText("12");

  await row.getByRole("button", { name: "Adjust stock" }).click();
  await fillFields([[page.getByRole("dialog").locator("#delta"), "-5"]]);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Save adjustment" })
    .click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "Not enough stock",
  );
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Close dialog" })
    .click();
  await expect(row.locator("td").nth(4)).toHaveText("3");

  await page.goto("/merchant/products");
  await expect(page.locator(".product-card", { hasText: name })).toContainText(
    "Low stock",
  );
  await page.goto("/merchant/dashboard");
  await expect(
    page.locator(".metric", { hasText: "Low stock" }).locator(".metric-value"),
  ).toHaveText("1");
});

test("a merchant edits a variant, sees stock history and arranges photos", async ({
  browser,
  page,
}) => {
  await approvedMerchant(browser, page, `Fix It ${unique()}`);
  await saveDraft(page, { name: `Pista roll ${unique()}` });
  await expect(
    page.getByRole("heading", { name: "A little product polish." }),
  ).toBeVisible();

  const row = page.getByRole("row", { name: /Default/ });
  await row.getByRole("button", { name: "Edit" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.locator("#editPrice")).toHaveValue("1299");
  await fillFields([[dialog.locator("#editPrice"), "999"]]);
  await dialog.getByRole("button", { name: "Save variant" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(row).toContainText("₹999");

  await row.getByRole("button", { name: "Adjust stock" }).click();
  const history = page
    .getByRole("dialog")
    .getByRole("list", { name: "Recent stock changes" });
  await expect(history).toContainText("Opening stock");
  await expect(history).toContainText("+12");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Close dialog" })
    .click();

  await uploadPixel(page);
  await page
    .locator("#imageFile")
    .setInputFiles("tests/fixtures/images/three-by-two.webp");
  await page.locator("#imageAlt").fill("Second photo");
  await page.getByRole("button", { name: "Upload image" }).click();
  await expect(page.locator(".product-images img")).toHaveCount(2);

  await page.getByRole("button", { name: "Move photo 2 earlier" }).click();
  await expect(page.locator(".product-images img").first()).toHaveAttribute(
    "alt",
    "Second photo",
  );

  await page
    .getByLabel("Description of photo 2")
    .fill("Rolls on a brass plate");
  await page
    .getByRole("button", { name: "Save description of photo 2" })
    .click();
  await page.reload();
  await expect(page.locator(".product-images img").nth(1)).toHaveAttribute(
    "alt",
    "Rolls on a brass plate",
  );
});

test("MRP below price shows a field error", async ({ browser, page }) => {
  await approvedMerchant(browser, page, `Price Check ${unique()}`);
  await saveDraft(page, {
    mrp: "1000",
    name: `Pista box ${unique()}`,
    price: "1500",
  });
  await expect(page.locator("#mrp-error")).toHaveText(
    "Price cannot be higher than the declared MRP.",
  );
  await expect(page).toHaveURL(/\/merchant\/products\/new$/);
});

test("overview counts real products", async ({ browser, page }) => {
  await approvedMerchant(browser, page, `Counted ${unique()}`);
  await saveDraft(page, { name: `Published one ${unique()}` });
  await expect(
    page.getByRole("heading", { name: "A little product polish." }),
  ).toBeVisible();
  await uploadPixel(page);
  await page.getByRole("button", { name: "Publish" }).click();
  await expect(page.locator(".badge", { hasText: "PUBLISHED" })).toBeVisible();
  await saveDraft(page, { name: `Draft one ${unique()}` });
  await expect(
    page.getByRole("heading", { name: "A little product polish." }),
  ).toBeVisible();

  await page.goto("/merchant/dashboard");
  await expect(
    page.locator(".metric", { hasText: "Published" }).locator(".metric-value"),
  ).toHaveText("1");
  await expect(
    page.locator(".metric", { hasText: "Drafts" }).locator(".metric-value"),
  ).toHaveText("1");
  await expect(
    page
      .locator(".metric", { hasText: "Out of stock" })
      .locator(".metric-value"),
  ).toHaveText("0");
});

test("archive asks first and is final", async ({ browser, page }) => {
  await approvedMerchant(browser, page, `Archive Test ${unique()}`);
  await saveDraft(page, { name: `Old stock ${unique()}` });
  await expect(
    page.getByRole("heading", { name: "A little product polish." }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Archive" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Archived products cannot be restored.");
  await dialog.getByRole("button", { name: "Archive product" }).click();
  await expect(page.locator(".badge", { hasText: "ARCHIVED" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: /^(Publish|Unpublish|Archive)$/ }),
  ).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Save changes" })).toHaveCount(
    0,
  );
});

test("a draft shop is redirected from products", async ({ page }) => {
  await signUpFresh(page, "draftprod");
  await onboardMerchant(page);
  await page.goto("/merchant/products");
  await expect(page).toHaveURL(/\/merchant\/onboarding$/);
});
