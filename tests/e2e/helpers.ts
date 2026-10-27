import type { Page } from "@playwright/test";

export interface TestUser {
  email: string;
  name: string;
  password: string;
}

export function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@e2e.gillu.test`;
}

export async function signUp(page: Page, user: TestUser): Promise<void> {
  await page.goto("/auth/sign-up");
  await page.locator("#name").fill(user.name);
  await page.locator("#email").fill(user.email);
  await page.locator("#password").fill(user.password);
  await page.locator("form button[type=submit]").click();
}

export async function signIn(
  page: Page,
  email: string,
  password: string,
): Promise<void> {
  if (!page.url().includes("/auth/sign-in")) {
    await page.goto("/auth/sign-in");
  }
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.locator("form button[type=submit]").click();
}

export async function sessionEmail(page: Page): Promise<null | string> {
  const response = await page.request.get("/api/auth/get-session");
  const body = (await response.json()) as null | { user?: { email?: string } };
  return body?.user?.email ?? null;
}
