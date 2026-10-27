"use client";

import type { SocialProviderId } from "~/lib/auth-social";

import { signIn } from "~/lib/auth-client";
import { GitHubIcon } from "~/ui/components/icons/github";
import { GoogleIcon } from "~/ui/components/icons/google";
import { Button } from "~/ui/primitives/button";
import { Separator } from "~/ui/primitives/separator";

const providerLabels: Record<SocialProviderId, string> = {
  github: "GitHub",
  google: "Google",
};

interface SocialSignInProps {
  callbackURL: string;
  disabled: boolean;
  onError: (message: string) => void;
  onStart: () => void;
  /** Only providers configured on the server; renders nothing when empty. */
  providers: SocialProviderId[];
}

export function SocialSignIn({
  callbackURL,
  disabled,
  onError,
  onStart,
  providers,
}: SocialSignInProps) {
  if (providers.length === 0) {
    return null;
  }

  const start = (provider: SocialProviderId) => {
    onStart();
    signIn.social({ callbackURL, provider }).catch((err: unknown) => {
      onError(`Failed to continue with ${providerLabels[provider]}`);
      console.error(err);
    });
  };

  return (
    <>
      <div className="relative mt-6">
        <div className="absolute inset-0 flex items-center">
          <Separator className="w-full" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">
            Or continue with
          </span>
        </div>
      </div>
      <div className="mt-6 grid grid-cols-2 gap-4">
        {providers.map((provider) => (
          <Button
            className="flex items-center gap-2"
            disabled={disabled}
            key={provider}
            onClick={() => {
              start(provider);
            }}
            variant="outline"
          >
            {provider === "github" ? (
              <GitHubIcon className="h-5 w-5" />
            ) : (
              <GoogleIcon className="h-5 w-5" />
            )}
            {providerLabels[provider]}
          </Button>
        ))}
      </div>
    </>
  );
}
