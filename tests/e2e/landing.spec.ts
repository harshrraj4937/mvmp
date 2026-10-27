import { expect, test } from "./helpers";

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

test("collection filter and product dialog", async ({ page }) => {
  await page.goto("/");
  const cards = page.locator("#discover article:visible");
  await page.getByRole("button", { name: "Handcrafted" }).click();
  await expect(cards).toHaveCount(1);
  await page.getByRole("button", { name: "All finds" }).click();
  await expect(cards).toHaveCount(3);

  const opener = page.getByRole("button", {
    name: "Explore Mithai and memories",
  });
  await opener.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText(
    "Orders and reservations are not yet open",
  );
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(opener).toBeFocused();
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
