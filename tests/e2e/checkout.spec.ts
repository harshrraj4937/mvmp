import { apiJson, expect, fillFields, test, twoMakerCart } from "./helpers";

test("a shopper adds an address and places a cash-on-delivery order", async ({
  browser,
  page,
}) => {
  const { shopper, storeA, storeB } = await twoMakerCart(browser, page);

  await shopper.goto("/checkout");
  await expect(
    shopper.getByRole("heading", { level: 1, name: "Checkout" }),
  ).toBeVisible();
  await expect(
    shopper.getByRole("heading", { name: `Parcel 1 of 2 · ${storeA}` }),
  ).toBeVisible();
  await expect(
    shopper.getByRole("heading", { name: `Parcel 2 of 2 · ${storeB}` }),
  ).toBeVisible();

  // No saved address yet: the form is open and ordering waits for it.
  await expect(
    shopper.getByRole("button", { name: "Place order" }),
  ).toBeDisabled();
  await fillFields([
    [shopper.locator("#fullName"), "Asha Naik"],
    [shopper.locator("#phone"), "98765 43210"],
    [shopper.locator("#line1"), "12 Fontainhas Road"],
    [shopper.locator("#city"), "Panaji"],
    [shopper.locator("#postalCode"), "12345"],
  ]);
  await shopper.locator("#state").selectOption("goa");
  await shopper.getByRole("button", { name: "Save address" }).click();
  await expect(shopper.locator("#postalCode-error")).toHaveText(
    "Enter a 6-digit PIN code.",
  );
  await shopper.locator("#postalCode").fill("403001");
  await shopper.getByRole("button", { name: "Save address" }).click();
  await expect(shopper.getByRole("radio", { name: /Asha Naik/ })).toBeChecked();

  await expect(
    shopper.getByRole("radio", { name: "Cash on delivery" }),
  ).toBeChecked();
  await expect(
    shopper.getByRole("radio", { name: /Pay online/ }),
  ).toBeDisabled();
  await expect(
    shopper.getByText(
      `Your order comes in 2 parcels. Pay each one when it arrives: ₹349 to ${storeA}, ₹500 to ${storeB}.`,
    ),
  ).toBeVisible();
  await expect(shopper.getByText("Delivery", { exact: true })).toBeVisible();
  await expect(shopper.getByText("Free", { exact: true })).toBeVisible();

  await shopper.getByRole("button", { name: "Place order" }).dblclick();
  await shopper.waitForURL(/\/orders\/GIL-\d+\?placed=1$/);

  const orders = await apiJson(await shopper.request.get("/api/v1/orders"));
  expect(orders.body.data).toHaveLength(1);
  const cart = await apiJson(await shopper.request.get("/api/v1/cart"));
  expect((cart.body.data as { count: number }).count).toBe(0);
});
