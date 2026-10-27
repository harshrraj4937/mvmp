import type {
  GithubProfile,
  GoogleProfile,
} from "better-auth/social-providers";

import { expect, test } from "vitest";

import { buildSocialProviders } from "~/lib/auth-social";

test("configures Google only when both id and secret are set", () => {
  expect(buildSocialProviders({ AUTH_GOOGLE_ID: "id" })).toEqual({});
  expect(
    buildSocialProviders({ AUTH_GOOGLE_ID: "id", AUTH_GOOGLE_SECRET: "s" })
      .google,
  ).toMatchObject({
    clientId: "id",
    clientSecret: "s",
    prompt: "select_account",
  });
});

test("maps the Google profile to first and last name", async () => {
  const google = buildSocialProviders({
    AUTH_GOOGLE_ID: "id",
    AUTH_GOOGLE_SECRET: "s",
  }).google;
  expect(
    await google?.mapProfileToUser?.({
      family_name: "Rao",
      given_name: "Asha",
    } as GoogleProfile),
  ).toEqual({ age: null, firstName: "Asha", lastName: "Rao" });
});

test("configures GitHub only when both id and secret are set", () => {
  expect(buildSocialProviders({ AUTH_GITHUB_SECRET: "s" })).toEqual({});
  expect(
    buildSocialProviders({ AUTH_GITHUB_ID: "id", AUTH_GITHUB_SECRET: "s" })
      .github,
  ).toMatchObject({ clientId: "id", clientSecret: "s" });
});

test("maps the GitHub display name to first and last name", async () => {
  const github = buildSocialProviders({
    AUTH_GITHUB_ID: "id",
    AUTH_GITHUB_SECRET: "s",
  }).github;
  expect(
    await github?.mapProfileToUser?.({
      name: "Asha Devi Rao",
    } as GithubProfile),
  ).toEqual({
    age: null,
    firstName: "Asha",
    lastName: "Devi Rao",
  });
});
