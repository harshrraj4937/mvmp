import type { Page } from "@playwright/test";

import {
  apiJson,
  expect,
  fillFields,
  newClientContext,
  saveAddress,
  sessionEmail,
  signUpFresh,
  test,
  twoMakerCart,
} from "./helpers";

async function placeOrder(shopper: Page): Promise<string> {
  const addressId = await saveAddress(shopper);
  const placed = await apiJson(
    await shopper.request.post("/api/v1/orders", {
      data: {
        addressId,
        checkoutKey: `e2e_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        expectedTotalPaise: 84_900,
        paymentMethod: "COD",
      },
    }),
  );
  expect(placed.status).toBe(201);
  return (placed.body.data as { number: string }).number;
}

test("a shopper sees their order and cancels one parcel", async ({
  browser,
  page,
}) => {
  const { shopper, storeA, storeB } = await twoMakerCart(browser, page);
  const number = await placeOrder(shopper);

  await shopper.goto(`/orders/${number}?placed=1`);
  await expect(
    shopper.getByRole("heading", {
      level: 1,
      name: `Thank you — your order ${number} is placed.`,
    }),
  ).toBeVisible();
  await expect(shopper.getByText("Payment: Cash on delivery")).toBeVisible();
  const parcelA = shopper.getByRole("region", { name: storeA });
  const parcelB = shopper.getByRole("region", { name: storeB });
  await expect(parcelA.getByText("Pay ₹349 on delivery")).toBeVisible();
  await expect(parcelB.getByText("Pay ₹500 on delivery")).toBeVisible();
  await expect(parcelA.getByText("Order placed")).toBeVisible();

  await shopper.goto("/orders");
  await expect(
    shopper.getByRole("heading", { level: 1, name: "My orders" }),
  ).toBeVisible();
  await shopper.getByRole("link", { name: number }).click();
  await expect(
    shopper.getByRole("heading", { level: 1, name: `Order ${number}` }),
  ).toBeVisible();

  await parcelB.getByRole("button", { name: "Cancel this parcel" }).click();
  await parcelB.getByRole("button", { name: "Yes, cancel" }).click();
  await expect(parcelB.getByText("Cancelled", { exact: true })).toBeVisible();
  await expect(parcelB.getByText("You cancelled this parcel.")).toBeVisible();
  await expect(parcelA.getByText("Order placed")).toBeVisible();
  await expect(
    shopper.getByRole("button", { name: "Cancel order" }),
  ).toHaveCount(0);

  const stranger = await (await newClientContext(browser)).newPage();
  await signUpFresh(stranger, "stranger");
  const response = await stranger.goto(`/orders/${number}`);
  expect(response?.status()).toBe(404);
});

test("a shopper manages saved addresses and signs out", async ({ page }) => {
  await signUpFresh(page, "addresses");
  await page.goto("/account/addresses");
  await expect(
    page.getByRole("heading", { level: 1, name: "Your addresses" }),
  ).toBeVisible();
  await expect(page.getByText("No saved addresses yet.")).toBeVisible();

  await page.getByRole("button", { name: "Add an address" }).click();
  await fillFields([
    [page.locator("#fullName"), "Asha Naik"],
    [page.locator("#phone"), "9876543210"],
    [page.locator("#line1"), "12 Fontainhas Road"],
    [page.locator("#city"), "Panaji"],
    [page.locator("#postalCode"), "403001"],
  ]);
  await page.locator("#state").selectOption("goa");
  await page.getByRole("button", { name: "Save address" }).click();
  const first = page.getByRole("listitem").filter({ hasText: "Panaji" });
  await expect(first.getByText("Default", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Add an address" }).click();
  await fillFields([
    [page.locator("#fullName"), "Ravi Naik"],
    [page.locator("#phone"), "9876500000"],
    [page.locator("#line1"), "4 Station Road"],
    [page.locator("#city"), "Margao"],
    [page.locator("#postalCode"), "403601"],
  ]);
  await page.locator("#state").selectOption("goa");
  await page.getByRole("button", { name: "Save address" }).click();
  const second = page.getByRole("listitem").filter({ hasText: "Margao" });
  await second.getByRole("button", { name: "Make default" }).click();
  await expect(second.getByText("Default", { exact: true })).toBeVisible();
  await expect(first.getByText("Default", { exact: true })).toHaveCount(0);

  await first.getByRole("button", { name: "Delete" }).click();
  await expect(
    page.getByRole("listitem").filter({ hasText: "Panaji" }),
  ).toHaveCount(0);

  await page.goto("/");
  await expect(
    page
      .getByRole("navigation", { name: "Main navigation" })
      .getByRole("link", {
        name: "My orders",
      }),
  ).toBeVisible();
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("button", { name: "Sign out" })
    .click();
  await expect(
    page
      .getByRole("navigation", { name: "Main navigation" })
      .getByRole("link", {
        name: "Sign in",
      }),
  ).toBeVisible();
  expect(await sessionEmail(page)).toBeNull();
});
