"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import type { SocialProviderId } from "~/lib/auth-social";

import { SEO_CONFIG, SYSTEM_CONFIG } from "~/app";
import { signUp } from "~/lib/auth-client";
import { SocialSignIn } from "~/ui/components/auth/social-sign-in";
import { Button } from "~/ui/primitives/button";
import { Card, CardContent } from "~/ui/primitives/card";
import { Input } from "~/ui/primitives/input";
import { Label } from "~/ui/primitives/label";

interface SignUpPageClientProps {
  next: null | string;
  socialProviders: SocialProviderId[];
}

export function SignUpPageClient({
  next,
  socialProviders,
}: SignUpPageClientProps) {
  const router = useRouter();
  const [formData, setFormData] = useState({
    email: "",
    name: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    void signUp
      .email({
        email: formData.email,
        name: formData.name,
        password: formData.password,
      })
      .then(({ error: signUpError }) => {
        if (signUpError) {
          setError("Registration failed. Please try again.");
          return;
        }
        router.push(next ?? SYSTEM_CONFIG.redirectAfterSignUp);
      })
      .catch((err: unknown) => {
        setError("Registration failed. Please try again.");
        console.error(err);
      })
      .finally(() => {
        setLoading(false);
      });
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
          alt="Sign-up background image"
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

      {/* Right side - Sign up form */}
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
            <h2 className="text-3xl font-bold">Create Account</h2>
            <p className="text-sm text-muted-foreground">
              Enter your details to create your account
            </p>
          </div>

          <Card className="border-none shadow-sm">
            <CardContent className="pt-2">
              <form className="space-y-4" onSubmit={handleSubmit}>
                <div className="grid gap-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    name="name"
                    onChange={handleChange}
                    placeholder="John Doe"
                    required
                    type="text"
                    value={formData.name}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    name="email"
                    onChange={handleChange}
                    placeholder="name@example.com"
                    required
                    type="email"
                    value={formData.email}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    name="password"
                    onChange={handleChange}
                    required
                    type="password"
                    value={formData.password}
                  />
                </div>
                {error && (
                  <div className="text-sm font-medium text-destructive">
                    {error}
                  </div>
                )}
                <Button className="w-full" disabled={loading} type="submit">
                  {loading ? "Creating account..." : "Create account"}
                </Button>
              </form>
              <SocialSignIn
                callbackURL={next ?? SYSTEM_CONFIG.redirectAfterSignUp}
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
                Already have an account?{" "}
                <Link
                  className={`
                    text-primary underline-offset-4
                    hover:underline
                  `}
                  href={
                    next
                      ? `/auth/sign-in?next=${encodeURIComponent(next)}`
                      : "/auth/sign-in"
                  }
                >
                  Sign in
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
