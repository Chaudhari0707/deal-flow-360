"use client";

import { type FormEvent, useRef, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Eye, EyeOff, LoaderCircle } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ThemeToggle } from "@/features/shell/theme-toggle";
import { apiClient, apiData } from "@/lib/api/client";
import { authClient } from "@/lib/auth/client";

function subscribeHydration() {
  return () => {};
}
function hydratedSnapshot() {
  return true;
}
function serverSnapshot() {
  return false;
}

const reviewerAccounts = [
  { email: "rep@dealflow360.demo", label: "Sales Representative" },
  { email: "manager@dealflow360.demo", label: "Sales Manager" },
  { email: "finance@dealflow360.demo", label: "Finance" },
  { email: "ops@dealflow360.demo", label: "Operations" },
  { email: "admin@dealflow360.demo", label: "Administrator" },
  { email: "acme@dealflow360.demo", label: "Customer portal" },
] as const;

export function AuthForm({
  mode,
  reviewerPassword,
}: {
  mode: "login" | "signup";
  reviewerPassword?: string;
}) {
  const hydrated = useSyncExternalStore(subscribeHydration, hydratedSnapshot, serverSnapshot);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const emailInput = useRef<HTMLInputElement>(null);
  const passwordInput = useRef<HTMLInputElement>(null);
  const [reviewerAccount, setReviewerAccount] = useState<string | null>(null);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const signup = mode === "signup";
  function chooseReviewer(email: string | null) {
    if (!email) return;
    if (emailInput.current) emailInput.current.value = email;
    if (reviewerPassword && passwordInput.current) passwordInput.current.value = reviewerPassword;
    setReviewerAccount(email);
    setError(null);
  }

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
    <main className="relative flex min-h-svh flex-col items-center justify-center gap-8 bg-muted p-6 md:p-10">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="flex w-full max-w-sm flex-col gap-6">
        <Link href="/" className="flex items-center justify-center self-center py-2">
          <Image
            src="/logo.png"
            alt="DealFlow360"
            width={240}
            height={80}
            className="h-14 w-auto object-contain"
            priority
          />
        </Link>
        <Card>
          <CardHeader className="gap-2 text-center">
            <CardTitle className="text-2xl">
              <h1>{signup ? "Create your account" : "Welcome back"}</h1>
            </CardTitle>
            <CardDescription>
              {signup
                ? "Start your sales workspace and bring every deal into focus."
                : "Your deals, deliveries, and revenue. All connected."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form method="post" onSubmit={submit}>
              <FieldGroup>
                {signup && (
                  <Field>
                    <FieldLabel htmlFor="name">Full name</FieldLabel>
                    <Input
                      id="name"
                      name="name"
                      autoComplete="name"
                      required
                      maxLength={100}
                      placeholder="Your full name"
                    />
                  </Field>
                )}
                <Field>
                  <FieldLabel htmlFor="email">Email address</FieldLabel>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    maxLength={254}
                    placeholder="you@company.com"
                    ref={emailInput}
                  />
                </Field>
                {!signup && (
                  <Field>
                    <FieldLabel htmlFor="reviewer-account">Reviewer account</FieldLabel>
                    <Select value={reviewerAccount} onValueChange={chooseReviewer}>
                      <SelectTrigger
                        id="reviewer-account"
                        aria-label="Reviewer account"
                        className="w-full"
                      >
                        <SelectValue placeholder="Choose a demo account" />
                      </SelectTrigger>
                      <SelectContent>
                        {reviewerAccounts.map((account) => (
                          <SelectItem key={account.email} value={account.email}>
                            {account.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FieldDescription>
                      {reviewerPassword
                        ? "Selecting an account fills its UAT email and password."
                        : "Selecting an account fills its UAT email. Enter the configured demo password."}
                    </FieldDescription>
                  </Field>
                )}
                <Field>
                  <FieldLabel htmlFor="password">Password</FieldLabel>
                  <div className="relative">
                    <Input
                      id="password"
                      name="password"
                      type={passwordVisible ? "text" : "password"}
                      autoComplete={signup ? "new-password" : "current-password"}
                      required
                      minLength={8}
                      maxLength={128}
                      placeholder={signup ? "At least 8 characters" : "Enter your password"}
                      ref={passwordInput}
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="absolute top-1/2 right-1 -translate-y-1/2"
                      aria-label={passwordVisible ? "Hide password" : "Show password"}
                      aria-pressed={passwordVisible}
                      onClick={() => setPasswordVisible((visible) => !visible)}
                    >
                      {passwordVisible ? <EyeOff /> : <Eye />}
                    </Button>
                  </div>
                </Field>
                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                <Field>
                  <Button type="submit" size="lg" disabled={pending || !hydrated}>
                    {pending ? <LoaderCircle className="animate-spin" /> : <ArrowRight />}
                    {pending ? "Please wait…" : signup ? "Create account" : "Sign in"}
                  </Button>
                  <FieldDescription className="text-center">
                    {signup ? "Already have an account? " : "New to DealFlow360? "}
                    <Link href={signup ? "/login" : "/signup"}>
                      {signup ? "Sign in" : "Create account"}
                    </Link>
                  </FieldDescription>
                </Field>
              </FieldGroup>
            </form>
          </CardContent>
        </Card>
        <FieldDescription className="text-center">
          From a better quote to a lasting customer relationship.
        </FieldDescription>
      </div>
    </main>
  );
}
