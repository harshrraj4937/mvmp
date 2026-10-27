import type { Page } from "@playwright/test";

import {
  apiJson,
  expect,
  grantAdminRole,
  newClientContext,
  onboardMerchant,
  signUpFresh,
  test,
} from "./helpers";

interface Pickup {
  id: string;
  label: string;
}

interface Profile {
  id: string;
  slug: string;
  status: string;
}

async function submitShop(page: Page): Promise<Profile> {
  await onboardMerchant(page);
  const { body } = await apiJson(
    await page.request.post("/api/v1/merchant/profile/submit"),
  );
  return body.data as Profile;
}

test("signed-out callers get 401 with a request id", async ({ page }) => {
  const { body, status } = await apiJson(
    await page.request.get("/api/v1/merchant/profile"),
  );
  expect(status).toBe(401);
  expect(body.error?.code).toBe("unauthorized");
  expect(body.requestId).toEqual(expect.any(String));
});

test("a signed-in user without a shop gets 403", async ({ page }) => {
  await signUpFresh(page, "noshop");
  const { body, status } = await apiJson(
    await page.request.get("/api/v1/merchant/profile"),
  );
  expect(status).toBe(403);
  expect(body.error?.code).toBe("forbidden");
});

test("onboarding creates one draft shop; a second attempt is refused", async ({
  page,
}) => {
  await signUpFresh(page, "onboard");
  const created = await onboardMerchant(page);
  expect(created.data).toMatchObject({
    contactPhone: "+919876543210",
    status: "DRAFT",
  });

  const again = await apiJson(
    await page.request.post("/api/v1/merchant/onboarding", {
      data: { storeName: "x" },
    }),
  );
  // Validation runs first, so send a valid payload to reach the rule.
  expect(again.status).toBe(400);
  const { validOnboarding } = await import("../support/merchant-fixtures");
  const duplicate = await apiJson(
    await page.request.post("/api/v1/merchant/onboarding", {
      data: validOnboarding(),
    }),
  );
  expect(duplicate.status).toBe(409);
  expect(duplicate.body.error?.code).toBe("already_merchant_owner");
});

test("invalid onboarding input returns field errors", async ({ page }) => {
  await signUpFresh(page, "badphone");
  const { validOnboarding } = await import("../support/merchant-fixtures");
  const { body, status } = await apiJson(
    await page.request.post("/api/v1/merchant/onboarding", {
      data: validOnboarding({ contactPhone: "12345" }),
    }),
  );
  expect(status).toBe(400);
  expect(body.error?.code).toBe("validation_failed");
  expect(body.error?.details?.contactPhone).toBeDefined();
});

test("edit, submit, then the shop is locked under review", async ({ page }) => {
  await signUpFresh(page, "submit");
  await onboardMerchant(page);

  const patched = await apiJson(
    await page.request.patch("/api/v1/merchant/profile", {
      data: { description: "Kanjivaram silk from family looms." },
    }),
  );
  expect(patched.status).toBe(200);
  expect(patched.body.data).toMatchObject({
    description: "Kanjivaram silk from family looms.",
  });

  const submitted = await apiJson(
    await page.request.post("/api/v1/merchant/profile/submit"),
  );
  expect((submitted.body.data as Profile).status).toBe("SUBMITTED");

  const locked = await apiJson(
    await page.request.patch("/api/v1/merchant/profile", {
      data: { description: "Changed" },
    }),
  );
  expect(locked.status).toBe(409);
  expect(locked.body.error?.code).toBe("under_review");
});

test("only admins review shops", async ({ browser, page }) => {
  await signUpFresh(page, "reviewme");
  const shop = await submitShop(page);

  // The merchant is not an admin.
  const denied = await apiJson(
    await page.request.post(`/api/v1/admin/merchants/${shop.id}/approve`),
  );
  expect(denied.status).toBe(403);
  const unchanged = await apiJson(
    await page.request.get("/api/v1/merchant/profile"),
  );
  expect((unchanged.body.data as Profile).status).toBe("SUBMITTED");

  const adminContext = await newClientContext(browser);
  const adminPage = await adminContext.newPage();
  grantAdminRole(await signUpFresh(adminPage, "reviewer"));

  const queue = await apiJson(
    await adminPage.request.get("/api/v1/admin/merchants?status=SUBMITTED"),
  );
  expect(queue.status).toBe(200);
  expect(queue.body.data).toEqual(
    expect.arrayContaining([expect.objectContaining({ id: shop.id })]),
  );

  const approved = await apiJson(
    await adminPage.request.post(`/api/v1/admin/merchants/${shop.id}/approve`),
  );
  expect((approved.body.data as Profile).status).toBe("APPROVED");

  const twice = await apiJson(
    await adminPage.request.post(`/api/v1/admin/merchants/${shop.id}/approve`),
  );
  expect(twice.status).toBe(409);
  expect(twice.body.error?.code).toBe("invalid_transition");

  const bogus = await apiJson(
    await adminPage.request.get("/api/v1/admin/merchants?status=BOGUS"),
  );
  expect(bogus.status).toBe(400);

  const rejectedWithoutReason = await apiJson(
    await adminPage.request.post(`/api/v1/admin/merchants/${shop.id}/reject`, {
      data: { reason: "no" },
    }),
  );
  expect(rejectedWithoutReason.status).toBe(400);
  await adminContext.close();
});

test("a merchant cannot touch another merchant's pickup location", async ({
  browser,
  page,
}) => {
  await signUpFresh(page, "shopa");
  await onboardMerchant(page);
  const aList = await apiJson(
    await page.request.get("/api/v1/merchant/pickup-locations"),
  );
  const [aLocation] = aList.body.data as Pickup[];

  const bContext = await newClientContext(browser);
  const bPage = await bContext.newPage();
  await signUpFresh(bPage, "shopb");
  await onboardMerchant(bPage);

  const hijack = await apiJson(
    await bPage.request.patch(
      `/api/v1/merchant/pickup-locations/${aLocation?.id}`,
      { data: { label: "Hijacked" } },
    ),
  );
  expect(hijack.status).toBe(404);

  const bList = await apiJson(
    await bPage.request.get("/api/v1/merchant/pickup-locations"),
  );
  expect(
    (bList.body.data as Pickup[]).some((l) => l.id === aLocation?.id),
  ).toBe(false);

  const aAfter = await apiJson(
    await page.request.get("/api/v1/merchant/pickup-locations"),
  );
  expect(aAfter.body.data).toEqual([aLocation]);

  const added = await apiJson(
    await bPage.request.post("/api/v1/merchant/pickup-locations", {
      data: {
        address: {
          city: "Jaipur",
          line1: "3 Johari Bazaar",
          postalCode: "302003",
          state: "Rajasthan",
        },
        contactName: "Imran",
        isPrimary: true,
        label: "Bazaar shop",
        phone: "9414012345",
      },
    }),
  );
  expect(added.status).toBe(201);
  expect(added.body.data).toMatchObject({
    isPrimary: true,
    postalCode: "302003",
  });
  await bContext.close();
});
