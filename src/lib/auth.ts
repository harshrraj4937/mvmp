// note: run `bun db:auth` to generate the `users.ts`
// schema after making breaking changes to this file

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { admin, twoFactor } from "better-auth/plugins";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import type { UserDbType } from "~/lib/auth-types";

import { SYSTEM_CONFIG } from "~/app";
import { db } from "~/db";
import {
  accountTable,
  sessionTable,
  twoFactorTable,
  userTable,
  verificationTable,
} from "~/db/schema";
import { getServerEnv } from "~/platform/env";

import { buildSocialProviders } from "./auth-social";

const socialProviders = buildSocialProviders(getServerEnv());

export const auth = betterAuth({
  account: {
    accountLinking: {
      allowDifferentEmails: false,
      enabled: true,
      trustedProviders: Object.keys(socialProviders),
    },
  },
  baseURL: getServerEnv().NEXT_SERVER_APP_URL,

  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      account: accountTable,
      session: sessionTable,
      twoFactor: twoFactorTable,
      user: userTable,
      verification: verificationTable,
    },
  }),

  emailAndPassword: {
    enabled: true,
  },

  // Configure OAuth behavior
  oauth: {
    // Default redirect URL after successful login
    defaultCallbackUrl: SYSTEM_CONFIG.redirectAfterSignIn,
    // URL to redirect to on error
    errorCallbackUrl: "/auth/error",
    // Whether to link accounts with the same email
    linkAccountsByEmail: true,
  },

  // nextCookies must stay last so it sees cookies set by other plugins.
  plugins: [twoFactor(), admin(), nextCookies()],

  secret: getServerEnv().AUTH_SECRET,

  // Only include social providers if credentials are available
  socialProviders,

  user: {
    additionalFields: {
      age: {
        input: true,
        required: false,
        type: "number",
      },
      firstName: {
        input: true,
        required: false,
        type: "string",
      },
      lastName: {
        input: true,
        required: false,
        type: "string",
      },
    },
  },
});

export const getCurrentUser = async (): Promise<null | UserDbType> => {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session) {
    return null;
  }
  return session.user as UserDbType;
};

export const getCurrentUserOrRedirect = async (
  forbiddenUrl = "/auth/sign-in",
  okUrl = "",
  ignoreForbidden = false,
): Promise<null | UserDbType> => {
  const user = await getCurrentUser();

  // if no user is found
  if (!user) {
    // redirect to forbidden url unless explicitly ignored
    if (!ignoreForbidden) {
      redirect(forbiddenUrl);
    }
    // if ignoring forbidden, return the null user immediately
    // (don't proceed to okUrl check)
    return user; // user is null here
  }

  // if user is found and an okUrl is provided, redirect there
  if (okUrl) {
    redirect(okUrl);
  }

  // if user is found and no okUrl is provided, return the user
  return user; // user is UserDbType here
};
