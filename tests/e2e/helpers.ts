import {
  test as base,
  type Browser,
  type BrowserContext,
  expect,
  type Locator,
  type Page,
} from "@playwright/test";
import { execFileSync } from "node:child_process";

import { validOnboarding } from "../support/merchant-fixtures";

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

let extraClientCounter = 0;

export interface ApiBody {
  [key: string]: unknown;
  data?: unknown;
  error?: { code: string; details?: Record<string, unknown>; message: string };
  requestId?: string;
}

export interface TestUser {
  email: string;
  name: string;
  password: string;
}

/** Response status plus parsed JSON body. */
export async function apiJson(response: {
  json: () => Promise<unknown>;
  status: () => number;
}): Promise<{ body: ApiBody; status: number }> {
  return {
    body: (await response.json()) as ApiBody,
    status: response.status(),
  };
}

/**
 * Signs `page` up as a fresh user with an APPROVED shop: onboards and submits
 * through the API, then approves it as an admin in a separate context.
 */
export async function approvedMerchant(
  browser: Browser,
  page: Page,
  storeName: string,
): Promise<{ shopId: string }> {
  await signUpFresh(page, "approved");
  const created = await onboardMerchant(page, { storeName });
  const shopId = (created.data as { id: string }).id;
  expect(
    (await page.request.post("/api/v1/merchant/profile/submit")).status(),
  ).toBe(200);

  const context = await newClientContext(browser);
  const admin = await context.newPage();
  grantAdminRole(await signUpFresh(admin, "admin"));
  const approved = await admin.request.post(
    `/api/v1/admin/merchants/${shopId}/approve`,
  );
  expect(approved.status()).toBe(200);
  await context.close();
  return { shopId };
}

/**
 * Fills form fields once React has hydrated them. Filling earlier races
 * hydration, which resets controlled inputs. React attaches a
 * `__reactProps$<id>` key to DOM nodes it has hydrated.
 */
export async function fillFields(
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

/**
 * Headers for an RSC request claiming the `/admin` layout is already on
 * screen, so Next.js renders only the page segment below it. Shape follows
 * Next 16's flightRouterStateSchema; an invalid tree is rejected by Next
 * and would test nothing.
 */
export function forgedAdminRscHeaders(): Record<string, string> {
  const tree = [
    "",
    { children: ["admin", { children: ["__PAGE__", {}] }] },
    null,
    null,
  ];
  return {
    "next-router-state-tree": encodeURIComponent(JSON.stringify(tree)),
    rsc: "1",
  };
}

/** Grants admin through the real CLI, using the E2E runner's environment. */
export function grantAdminRole(email: string): void {
  execFileSync("bun", ["scripts/admin-grant.ts", email], { stdio: "pipe" });
}

/** A second browser context acting as another client IP (another person). */
export async function newClientContext(
  browser: Browser,
): Promise<BrowserContext> {
  extraClientCounter += 1;
  const context = await browser.newContext();
  await context.setExtraHTTPHeaders({
    "x-forwarded-for": `203.0.113.${(base.info().workerIndex * 50 + extraClientCounter) % 250}`,
  });
  return context;
}

/** Creates a draft shop for the signed-in user through the API. */
export async function onboardMerchant(
  page: Page,
  overrides: Parameters<typeof validOnboarding>[0] = {},
): Promise<ApiBody> {
  const response = await page.request.post("/api/v1/merchant/onboarding", {
    data: validOnboarding(overrides),
  });
  expect(response.status()).toBe(201);
  return (await response.json()) as ApiBody;
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

/** Signs up a fresh user on `page` and waits until they are signed in. */
export async function signUpFresh(page: Page, prefix: string): Promise<string> {
  const email = uniqueEmail(prefix);
  await signUp(page, {
    email,
    name: "Gillu Tester",
    password: "Correct-Horse-9-Battery",
  });
  await expect(page).toHaveURL(/\/dashboard\/uploads/);
  return email;
}

export function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@e2e.gillu.test`;
}
