import { SYSTEM_CONFIG } from "~/app";
import { getCurrentUserOrRedirect } from "~/lib/auth";
import { configuredSocialProviders } from "~/lib/auth-social";
import { safeNextPath } from "~/lib/safe-next-path";

import { SignUpPageClient } from "./page.client";

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const { next: rawNext } = await searchParams;
  const next = safeNextPath(typeof rawNext === "string" ? rawNext : null);

  // Already signed in: go where the visitor was heading.
  await getCurrentUserOrRedirect(
    undefined,
    next ?? SYSTEM_CONFIG.redirectAfterSignIn,
    true,
  );

  return (
    <SignUpPageClient
      next={next}
      socialProviders={configuredSocialProviders()}
    />
  );
}
