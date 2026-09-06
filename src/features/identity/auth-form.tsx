"use client";

import { type FormEvent, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { LoaderCircle } from "lucide-react";

import { BrandLogo } from "@/components/brand/brand-logo";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/features/shell/theme-toggle";
import { apiClient, apiData } from "@/lib/api/client";
import { authClient } from "@/lib/auth/client";

/**
 * Editorial auth surface. The page is the composition — a brand strip, a strong masthead rule and
 * a single column held to a readable measure — rather than a card floating on a tinted ground.
 * Quiet labels take their quietness from size, case and letter-spacing, never from transparency,
 * and every input keeps the primitive's focus ring on top of its own rule.
 */
const labelType = "text-[0.6875rem] font-medium tracking-[0.16em] text-muted-foreground uppercase";
const ruledInput =
  "h-9 rounded-none border-0 border-b-2 border-border-strong bg-transparent px-0 text-sm focus-visible:border-ink-accent dark:bg-transparent";

function subscribeHydration() {
  return () => {};
}
function hydratedSnapshot() {
  return true;
}
function serverSnapshot() {
  return false;
}

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const hydrated = useSyncExternalStore(subscribeHydration, hydratedSnapshot, serverSnapshot);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const signup = mode === "signup";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    try {
      const credentials = {
        email: String(data.get("email") ?? "").trim(),
        password: String(data.get("password") ?? ""),
      };
      const result = signup
        ? await authClient.signUp.email({
            ...credentials,
            name: String(data.get("name") ?? "").trim(),
          })
        : await authClient.signIn.email(credentials);
      if (result.error) {
        setError(result.error.message ?? "We couldn't sign you in. Please check your details.");
        return;
      }
      const { actor } = apiData(await apiClient.api.v1.me.get());
      // A full navigation clears the previous account's client data.
      window.location.assign(
        actor.mustChangePassword
          ? "/change-password"
          : actor.role === "customer"
            ? "/portal"
            : "/dashboard",
      );
    } catch {
      setError("Unable to connect. Check that the local server is running and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="flex min-h-svh flex-col bg-background px-6 py-6 md:px-10 md:py-8">
      <div className="mx-auto flex w-full max-w-md items-center justify-between gap-6">
        <Link href="/" className="inline-flex items-center">
          <BrandLogo priority className="text-3xl" />
        </Link>
        <ThemeToggle />
      </div>

      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-12">
        <div className="border-t-2 border-foreground pt-7">
          <span aria-hidden className="block h-0.5 w-7 bg-ink-accent" />
          <h1 className="mt-4 text-3xl leading-[1.1] font-semibold tracking-tight text-foreground md:text-4xl">
            {signup ? "Create your account" : "Welcome back"}
          </h1>
          <p className="mt-3 max-w-[46ch] text-[0.9375rem] leading-relaxed text-muted-foreground">
            {signup
              ? "Start your sales workspace and bring every deal into focus."
              : "Your deals, deliveries, and revenue. All connected."}
          </p>
        </div>

        <form method="post" onSubmit={submit} className="mt-10">
          <FieldGroup className="gap-7">
            {signup && (
              <Field>
                <FieldLabel htmlFor="name" className={labelType}>
                  Full name
                </FieldLabel>
                <Input
                  id="name"
                  name="name"
                  autoComplete="name"
                  required
                  maxLength={100}
                  placeholder="Your full name"
                  className={ruledInput}
                />
              </Field>
            )}
            <Field>
              <FieldLabel htmlFor="email" className={labelType}>
                Email address
              </FieldLabel>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                maxLength={254}
                placeholder="you@company.com"
                className={ruledInput}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="password" className={labelType}>
                Password
              </FieldLabel>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete={signup ? "new-password" : "current-password"}
                required
                minLength={8}
                maxLength={128}
                placeholder={signup ? "At least 8 characters" : "Enter your password"}
                className={ruledInput}
              />
            </Field>
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <Field>
              <Button
                type="submit"
                size="lg"
                disabled={pending || !hydrated}
                className="mt-1 w-full"
              >
                {pending && <LoaderCircle className="animate-spin" />}
                {pending ? "Please wait…" : signup ? "Create account" : "Sign in"}
              </Button>
              <FieldDescription className="pt-3">
                {signup ? "Already have an account? " : "New to DealFlow360? "}
                <Link href={signup ? "/login" : "/signup"}>
                  {signup ? "Sign in" : "Create account"}
                </Link>
              </FieldDescription>
            </Field>
          </FieldGroup>
        </form>
      </div>

      <div className="mx-auto w-full max-w-md border-t border-border pt-5">
        <FieldDescription>From a better quote to a lasting customer relationship.</FieldDescription>
      </div>
    </main>
  );
}
