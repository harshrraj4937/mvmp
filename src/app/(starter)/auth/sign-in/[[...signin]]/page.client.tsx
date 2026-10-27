"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import type { SocialProviderId } from "~/lib/auth-social";

import { SEO_CONFIG, SYSTEM_CONFIG } from "~/app";
import { signIn } from "~/lib/auth-client";
import { SocialSignIn } from "~/ui/components/auth/social-sign-in";
import { Button } from "~/ui/primitives/button";
import { Card, CardContent } from "~/ui/primitives/card";
import { Input } from "~/ui/primitives/input";
import { Label } from "~/ui/primitives/label";

interface SignInPageClientProps {
  next: null | string;
  socialProviders: SocialProviderId[];
}

export function SignInPageClient({
  next,
  socialProviders,
}: SignInPageClientProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const { error: signInError } = await signIn.email({
        email,
        password,
      });
      if (signInError) {
        setError("Invalid email or password");
        return;
      }
      router.push(next ?? SYSTEM_CONFIG.redirectAfterSignIn);
    } catch (err) {
      setError("Invalid email or password");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={`
        grid h-screen w-screen
        md:grid-cols-2
      `}
    >
      {/* Left side - Image */}
      <div
        className={`
          relative hidden
          md:block
        `}
      >
        <Image
          alt="Sign-in background image"
          className="object-cover"
          fill
          priority
          sizes="(max-width: 768px) 0vw, 50vw"
          src="https://images.unsplash.com/photo-1719811059181-09032aef07b8?q=80&w=1200&auto=format&fit=crop&ixlib=rb-4.0.3"
        />
        <div
          className={`
            absolute inset-0 bg-gradient-to-t from-background/80 to-transparent
          `}
        />
        <div className="absolute bottom-8 left-8 z-10 text-white">
          <h1 className="text-3xl font-bold">{SEO_CONFIG.name}</h1>
          <p className="mt-2 max-w-md text-sm text-white/80">
            {SEO_CONFIG.slogan}
          </p>
        </div>
      </div>

      {/* Right side - Login form */}
      <div
        className={`
          flex items-center justify-center p-4
          md:p-8
        `}
      >
        <div className="w-full max-w-md space-y-4">
          <div
            className={`
              space-y-4 text-center
              md:text-left
            `}
          >
            <h2 className="text-3xl font-bold">Sign In</h2>
            <p className="text-sm text-muted-foreground">
              Enter your credentials to access your account
            </p>
          </div>

          <Card className="border-none shadow-sm">
            <CardContent className="pt-2">
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  void handleEmailLogin(e);
                }}
              >
                <div className="grid gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    onChange={(e) => {
                      setEmail(e.target.value);
                    }}
                    placeholder="name@example.com"
                    required
                    type="email"
                    value={email}
                  />
                </div>
                <div className="grid gap-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    <Link
                      className={`
                        text-sm text-muted-foreground
                        hover:underline
                      `}
                      href="#"
                    >
                      Forgot password?
                    </Link>
                  </div>
                  <Input
                    id="password"
                    onChange={(e) => {
                      setPassword(e.target.value);
                    }}
                    required
                    type="password"
                    value={password}
                  />
                </div>
                {error && (
                  <div className="text-sm font-medium text-destructive">
                    {error}
                  </div>
                )}
                <Button className="w-full" disabled={loading} type="submit">
                  {loading ? "Signing in..." : "Sign in"}
                </Button>
              </form>
              <SocialSignIn
                callbackURL={next ?? SYSTEM_CONFIG.redirectAfterSignIn}
                disabled={loading}
                onError={(message) => {
                  setError(message);
                  setLoading(false);
                }}
                onStart={() => {
                  setLoading(true);
                }}
                providers={socialProviders}
              />
              <div className="mt-6 text-center text-sm text-muted-foreground">
                Don't have an account?{" "}
                <Link
                  className={`
                    text-primary underline-offset-4
                    hover:underline
                  `}
                  href={
                    next
                      ? `/auth/sign-up?next=${encodeURIComponent(next)}`
                      : "/auth/sign-up"
                  }
                >
                  Sign up
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
