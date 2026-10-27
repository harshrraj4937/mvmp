import {
  apiJson,
  expect,
  forgedAdminRscHeaders,
  grantAdminRole,
  signUpFresh,
  test,
} from "./helpers";

test("an admin adds a category and hides it", async ({ page }) => {
  grantAdminRole(await signUpFresh(page, "catadmin"));
  const name = `Pickles and preserves ${Date.now()}`;

  await page.goto("/admin/categories");
  await page.getByLabel("New category").fill(name);
  await page.getByRole("button", { name: "Add category" }).click();
  await expect(page.getByLabel(`Name of ${name}`)).toHaveValue(name);

  await page.getByLabel("New category").fill(name.toUpperCase());
  await page.getByRole("button", { name: "Add category" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toHaveText(
    "A category with that name exists.",
  );

  await page.getByRole("button", { name: `Hide ${name}` }).click();
  await expect(
    page.getByRole("button", { name: `Show ${name}` }),
  ).toBeVisible();
  const active = await apiJson(await page.request.get("/api/v1/categories"));
  expect(
    (active.body.data as { name: string }[]).map((category) => category.name),
  ).not.toContain(name);
});

test("non-admins cannot manage categories", async ({ page }) => {
  await signUpFresh(page, "catuser");
  const response = await page.goto("/admin/categories");
  expect(response?.status()).toBe(404);

  // A forged RSC request must not stream the admin page either.
  const forged = await page.request.get("/admin/categories", {
    headers: forgedAdminRscHeaders(),
  });
  expect(forged.headers()["content-type"]).toContain("text/x-component");
  expect(await forged.text()).not.toContain("Add category");

  const list = await apiJson(
    await page.request.get("/api/v1/admin/categories"),
  );
  expect(list.status).toBe(403);
  const create = await apiJson(
    await page.request.post("/api/v1/admin/categories", {
      data: { name: "Sneaky" },
    }),
  );
  expect(create.status).toBe(403);
});

test("the public category list needs no session", async ({ request }) => {
  const result = await apiJson(await request.get("/api/v1/categories"));
  expect(result.status).toBe(200);
  expect((result.body.data as { name: string }[])[0]?.name).toBe(
    "Regional packaged food",
  );
});
