import {
  test as base,
  expect,
  type Locator,
  type Page,
} from "@playwright/test";
import { execFileSync } from "node:child_process";

let clientCounter = 0;

/**
 * Each test acts as a distinct client IP. better-auth rate-limits
 * sign-in/sign-up per IP (3 per 10 s in production), which every test
 * would otherwise share as 127.0.0.1.
 */
export const test = base.extend({
  context: async ({ context }, use, testInfo) => {
    clientCounter += 1;
    await context.setExtraHTTPHeaders({
      "x-forwarded-for": `198.51.100.${(testInfo.workerIndex * 50 + clientCounter) % 250}`,
    });
    await use(context);
  },
});

export { expect };

export interface TestUser {
  email: string;
  name: string;
  password: string;
}

/** Grants admin through the real CLI, using the E2E runner's environment. */
export function grantAdminRole(email: string): void {
  execFileSync("bun", ["scripts/admin-grant.ts", email], { stdio: "pipe" });
}

export async function sessionEmail(page: Page): Promise<null | string> {
  const response = await page.request.get("/api/auth/get-session");
  const body = (await response.json()) as null | { user?: { email?: string } };
  return body?.user?.email ?? null;
}

export async function signIn(
  page: Page,
  email: string,
  password: string,
): Promise<void> {
  if (!page.url().includes("/auth/sign-in")) {
    await page.goto("/auth/sign-in");
  }
  await fillFields([
    [page.locator("#email"), email],
    [page.locator("#password"), password],
  ]);
  await page.locator("form button[type=submit]").click();
}

export async function signOut(page: Page): Promise<void> {
  await page.goto("/auth/sign-out");
  const logOut = page.getByRole("button", { name: "Log out" });
  await logOut.evaluate(async (element) => {
    while (
      !Object.keys(element).some((key) => key.startsWith("__reactProps"))
    ) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  });
  await logOut.click();
  await page.waitForURL((url) => url.pathname === "/");
}

export async function signUp(page: Page, user: TestUser): Promise<void> {
  await page.goto("/auth/sign-up");
  await fillFields([
    [page.locator("#name"), user.name],
    [page.locator("#email"), user.email],
    [page.locator("#password"), user.password],
  ]);
  await page.locator("form button[type=submit]").click();
}

export function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@e2e.gillu.test`;
}

/**
 * Fills form fields once React has hydrated them. Filling earlier races
 * hydration, which resets controlled inputs. React attaches a
 * `__reactProps$<id>` key to DOM nodes it has hydrated.
 */
async function fillFields(
  fields: [locator: Locator, value: string][],
): Promise<void> {
  for (const [locator] of fields) {
    await locator.evaluate(async (element) => {
      while (
        !Object.keys(element).some((key) => key.startsWith("__reactProps"))
      ) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    });
  }
  for (const [locator, value] of fields) {
    await locator.fill(value);
  }
  for (const [locator, value] of fields) {
    await expect(locator).toHaveValue(value);
  }
}
