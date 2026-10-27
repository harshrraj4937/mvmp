import type {
  GithubOptions,
  GoogleOptions,
} from "better-auth/social-providers";

import { getServerEnv, type ServerEnv } from "~/platform/env";

export type SocialProviderId = "github" | "google";

type SocialEnv = Partial<
  Pick<
    ServerEnv,
    | "AUTH_GITHUB_ID"
    | "AUTH_GITHUB_SECRET"
    | "AUTH_GOOGLE_ID"
    | "AUTH_GOOGLE_SECRET"
  >
>;

interface SocialProviders {
  github?: GithubOptions;
  google?: GoogleOptions;
}

/** Social sign-in providers; a provider is enabled only with both id and secret. */
export function buildSocialProviders(env: SocialEnv): SocialProviders {
  const providers: SocialProviders = {};

  if (env.AUTH_GITHUB_ID && env.AUTH_GITHUB_SECRET) {
    providers.github = {
      clientId: env.AUTH_GITHUB_ID,
      clientSecret: env.AUTH_GITHUB_SECRET,
      mapProfileToUser: (profile) => {
        const [firstName = "", ...rest] = (profile.name ?? "").split(" ");
        return { age: null, firstName, lastName: rest.join(" ") };
      },
      scope: ["user:email", "read:user"],
    };
  }

  if (env.AUTH_GOOGLE_ID && env.AUTH_GOOGLE_SECRET) {
    providers.google = {
      clientId: env.AUTH_GOOGLE_ID,
      clientSecret: env.AUTH_GOOGLE_SECRET,
      mapProfileToUser: (profile) => ({
        age: null,
        firstName: profile.given_name ?? "",
        lastName: profile.family_name ?? "",
      }),
      // Let people with several Google accounts pick the right one.
      prompt: "select_account",
      scope: ["openid", "email", "profile"],
    };
  }

  return providers;
}

export function configuredSocialProviders(): SocialProviderId[] {
  return Object.keys(
    buildSocialProviders(getServerEnv()),
  ) as SocialProviderId[];
}
