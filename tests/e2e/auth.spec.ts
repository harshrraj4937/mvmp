import {
  expect,
  sessionEmail,
  signIn,
  signOut,
  signUp,
  test,
  uniqueEmail,
} from "./helpers";

const password = "Correct-Horse-9-Battery";

test("sign up, sign out and sign back in with email and password", async ({
  page,
}) => {
  const user = { email: uniqueEmail("smoke"), name: "Asha Test", password };
  await signUp(page, user);
  await expect(page).toHaveURL(/\/dashboard\/uploads/);
  expect(await sessionEmail(page)).toBe(user.email);

  await signOut(page);
  expect(await sessionEmail(page)).toBeNull();

  await signIn(page, user.email, user.password);
  await expect(page).toHaveURL(/\/dashboard\/uploads/);
  expect(await sessionEmail(page)).toBe(user.email);
});

test("wrong password shows an error and does not create a session", async ({
  page,
}) => {
  const user = { email: uniqueEmail("wrongpw"), name: "Ravi Test", password };
  await signUp(page, user);
  await expect(page).toHaveURL(/\/dashboard\/uploads/);
  await signOut(page);

  await signIn(page, user.email, "not-the-password");
  await expect(page.getByText("Invalid email or password")).toBeVisible();
  await expect(page).toHaveURL(/\/auth\/sign-in/);
  expect(await sessionEmail(page)).toBeNull();
});

test("signing up twice with the same email shows an error", async ({
  page,
}) => {
  const user = { email: uniqueEmail("dup"), name: "Meera Test", password };
  await signUp(page, user);
  await expect(page).toHaveURL(/\/dashboard\/uploads/);
  await signOut(page);

  await signUp(page, user);
  await expect(
    page.getByText("Registration failed. Please try again."),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/auth\/sign-up/);
  expect(await sessionEmail(page)).toBeNull();
});
