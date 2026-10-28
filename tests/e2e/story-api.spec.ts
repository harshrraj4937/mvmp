import { readFileSync } from "node:fs";

import { apiJson, expect, onboardMerchant, signUpFresh, test } from "./helpers";

const png = readFileSync("tests/fixtures/images/pixel.png");

test("the story API needs a signed-in shop member", async ({ page }) => {
  const anonymous = await apiJson(
    await page.request.get("/api/v1/merchant/story"),
  );
  expect(anonymous.status).toBe(401);
  expect(anonymous.body).toMatchObject({
    error: { code: "unauthorized" },
    requestId: expect.any(String),
  });
});

test("a draft shop writes its story and uploads a photo", async ({ page }) => {
  await signUpFresh(page, "story");
  await onboardMerchant(page);

  const saved = await apiJson(
    await page.request.patch("/api/v1/merchant/story", {
      data: {
        homePlace: "Malvan",
        homeState: "maharashtra",
        story: "We roast cashews in our courtyard kitchen. ".repeat(5),
      },
    }),
  );
  expect(saved).toMatchObject({
    body: { data: { complete: false, homePlace: "Malvan" } },
    status: 200,
  });

  const short = await apiJson(
    await page.request.patch("/api/v1/merchant/story", {
      data: { story: "Too short." },
    }),
  );
  expect(short).toMatchObject({
    body: {
      error: {
        code: "validation_failed",
        details: { story: [expect.any(String)] },
      },
    },
    status: 400,
  });

  const uploaded = await apiJson(
    await page.request.post("/api/v1/merchant/story/images", {
      multipart: {
        file: { buffer: png, mimeType: "image/png", name: "kitchen.png" },
      },
    }),
  );
  expect(uploaded.status).toBe(201);
  const imageId = (uploaded.body.data as { id: string }).id;

  const story = await apiJson(await page.request.get("/api/v1/merchant/story"));
  expect(story.body.data).toMatchObject({
    complete: true,
    images: [{ id: imageId }],
  });

  const described = await apiJson(
    await page.request.patch(`/api/v1/merchant/story/images/${imageId}`, {
      data: { alt: "Our kitchen" },
    }),
  );
  expect(described.body.data).toMatchObject({ alt: "Our kitchen" });

  const removed = await apiJson(
    await page.request.delete(`/api/v1/merchant/story/images/${imageId}`),
  );
  expect(removed).toMatchObject({ body: { data: null }, status: 200 });
});
