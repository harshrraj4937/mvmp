import type { Locator, Page } from "@playwright/test";

import { expect, onboardMerchant, signUpFresh, test } from "./helpers";

const unique = () => Math.random().toString(36).slice(2, 8).toUpperCase();

const STORY = "We roast cashews in our courtyard kitchen by the sea. ".repeat(
  4,
);

async function addPhoto(page: Page, alt: string, count: number) {
  const panel = page.locator("#story");
  await panel.locator("#storyImageAlt").fill(alt);
  await panel
    .locator("#storyImageFile")
    .setInputFiles("tests/fixtures/images/pixel.png");
  await panel.getByRole("button", { name: "Upload photo" }).click();
  await expect(panel.locator("ul.product-images li")).toHaveCount(count);
}

function photoAlts(panel: Locator) {
  return panel
    .locator("ul.product-images li img")
    .evaluateAll((images) => images.map((image) => image.getAttribute("alt")));
}

test("a merchant writes the shop story, adds photos, and arranges them", async ({
  page,
}) => {
  await signUpFresh(page, "story");
  await onboardMerchant(page, { storeName: `Story Shop ${unique()}` });
  await page.goto("/merchant/profile");

  const panel = page.locator("#story");
  await expect(
    panel.getByRole("heading", { name: "Your story" }),
  ).toBeVisible();
  await expect(panel.getByRole("status")).toContainText(
    "Your story is not complete yet",
  );

  await panel.locator("#shopStory").fill("Too short.");
  await panel.getByRole("button", { name: "Save story" }).click();
  await expect(panel.locator("#shopStory-error")).toContainText(
    "at least 150 characters",
  );

  await panel.locator("#shopStory").fill(STORY);
  await panel.locator("#homePlace").fill("Malvan");
  await panel.locator("#homeState").selectOption("maharashtra");
  await panel.getByRole("button", { name: "Save story" }).click();
  await expect(panel.getByText("Story saved.")).toBeVisible();
  await expect(panel.getByRole("status")).toContainText(
    "Your story is not complete yet",
  );

  await addPhoto(page, "First kitchen", 1);
  await expect(panel.getByRole("status")).toHaveText("Your story is complete.");
  await addPhoto(page, "Second bench", 2);
  expect(await photoAlts(panel)).toEqual(["First kitchen", "Second bench"]);

  await panel.getByRole("button", { name: "Move photo 2 earlier" }).click();
  await expect
    .poll(() => photoAlts(panel))
    .toEqual(["Second bench", "First kitchen"]);

  await panel.getByRole("button", { name: "Remove photo 2" }).click();
  await expect(panel.locator("ul.product-images li")).toHaveCount(1);
  await page.reload();
  await expect
    .poll(() => photoAlts(page.locator("#story")))
    .toEqual(["Second bench"]);
  await expect(page.locator("#story").getByRole("status")).toHaveText(
    "Your story is complete.",
  );
});
