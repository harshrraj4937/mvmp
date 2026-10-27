import { createId } from "@paralleldrive/cuid2";
import { afterAll, expect, test } from "vitest";

import { submitMerchant } from "~/modules/merchants/application/profile";
import {
  approveMerchant,
  getMerchantForAdmin,
  listMerchants,
  reinstateMerchant,
  rejectMerchant,
  suspendMerchant,
} from "~/modules/merchants/application/review";

import { testAdmin } from "../../support/merchant-fixtures";
import { connectTestDb } from "../support/db";
import { seedMerchant, seedUser } from "../support/merchants";

const { close, db } = connectTestDb();
afterAll(close);

const admin = async () => testAdmin(await seedUser(db, "admin"));

async function submittedMerchant() {
  const ctx = await seedMerchant(db);
  await submitMerchant(db, ctx);
  return ctx;
}

test("approving a submitted shop records the reviewer", async () => {
  const reviewer = await admin();
  const ctx = await submittedMerchant();
  const profile = await approveMerchant(db, reviewer, ctx.merchantId);
  expect(profile.status).toBe("APPROVED");
  expect(profile.reviewedAt).toBeInstanceOf(Date);
  const detail = await getMerchantForAdmin(db, reviewer, ctx.merchantId);
  expect(detail).toMatchObject({ reviewedBy: reviewer.id, status: "APPROVED" });
});

test("a draft cannot be approved", async () => {
  const ctx = await seedMerchant(db);
  await expect(
    approveMerchant(db, await admin(), ctx.merchantId),
  ).rejects.toMatchObject({ code: "invalid_transition", status: 409 });
});

test("reject stores the reason; suspend and reinstate an approved shop", async () => {
  const reviewer = await admin();
  const rejected = await submittedMerchant();
  await expect(
    rejectMerchant(db, reviewer, rejected.merchantId, "Blurry logo"),
  ).resolves.toMatchObject({
    rejectionReason: "Blurry logo",
    status: "REJECTED",
  });

  const ctx = await submittedMerchant();
  await approveMerchant(db, reviewer, ctx.merchantId);
  await expect(
    suspendMerchant(db, reviewer, ctx.merchantId),
  ).resolves.toMatchObject({ status: "SUSPENDED" });
  await expect(
    reinstateMerchant(db, reviewer, ctx.merchantId),
  ).resolves.toMatchObject({ status: "APPROVED" });
});

test("an unknown merchant is 404", async () => {
  const reviewer = await admin();
  await expect(approveMerchant(db, reviewer, createId())).rejects.toMatchObject(
    { code: "not_found", status: 404 },
  );
  await expect(
    getMerchantForAdmin(db, reviewer, createId()),
  ).rejects.toMatchObject({ status: 404 });
});

test("two admins acting on one submission at once: exactly one wins", async () => {
  const ctx = await submittedMerchant();
  const [first, second] = [await admin(), await admin()];

  const results = await Promise.allSettled([
    approveMerchant(db, first, ctx.merchantId),
    rejectMerchant(db, second, ctx.merchantId, "Incomplete address"),
  ]);

  const fulfilled = results.filter((r) => r.status === "fulfilled");
  expect(fulfilled).toHaveLength(1);
  expect(results.find((r) => r.status === "rejected")).toMatchObject({
    reason: { code: "invalid_transition" },
  });
  const winner = (fulfilled[0] as PromiseFulfilledResult<{ status: string }>)
    .value;
  const detail = await getMerchantForAdmin(db, first, ctx.merchantId);
  expect(detail.status).toBe(winner.status);
});

test("the review queue filters by status and shows the owner email", async () => {
  const reviewer = await admin();
  const submitted = await submittedMerchant();
  const draft = await seedMerchant(db);

  const queue = await listMerchants(db, reviewer, { status: "SUBMITTED" });
  expect(queue.every((item) => item.status === "SUBMITTED")).toBe(true);
  const item = queue.find((entry) => entry.id === submitted.merchantId);
  expect(item?.ownerEmail).toMatch(/@merchants\.gillu\.test$/);
  expect(queue.some((entry) => entry.id === draft.merchantId)).toBe(false);

  const all = await listMerchants(db, reviewer, {});
  expect(all.some((entry) => entry.id === draft.merchantId)).toBe(true);
});

test("the admin detail includes pickup locations", async () => {
  const ctx = await seedMerchant(db);
  const detail = await getMerchantForAdmin(db, await admin(), ctx.merchantId);
  expect(detail.pickupLocations).toEqual([
    expect.objectContaining({ isPrimary: true, postalCode: "560001" }),
  ]);
  expect(detail.complianceVerified).toBe(false);
});

test("approve and reinstate only work from their own state", async () => {
  const reviewer = await admin();
  const suspended = await submittedMerchant();
  await approveMerchant(db, reviewer, suspended.merchantId);
  await suspendMerchant(db, reviewer, suspended.merchantId);
  await expect(
    approveMerchant(db, reviewer, suspended.merchantId),
  ).rejects.toMatchObject({ code: "invalid_transition" });

  const submitted = await submittedMerchant();
  await expect(
    reinstateMerchant(db, reviewer, submitted.merchantId),
  ).rejects.toMatchObject({ code: "invalid_transition" });
});
