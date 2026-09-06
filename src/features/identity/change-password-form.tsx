"use client";

import { type FormEvent, useState } from "react";

import { BrandLogo } from "@/components/brand/brand-logo";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth/client";

/** Matches the sign-in surface: brand strip, masthead rule, one ruled column of quiet fields. */
const labelType = "text-[0.6875rem] font-medium tracking-[0.16em] text-muted-foreground uppercase";
const ruledInput =
  "h-9 rounded-none border-0 border-b-2 border-border-strong bg-transparent px-0 text-sm focus-visible:border-ink-accent dark:bg-transparent";

export function ChangePasswordForm() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const currentPassword = String(form.get("currentPassword") ?? "");
    const newPassword = String(form.get("newPassword") ?? "");
    if (newPassword === currentPassword) {
      setError("Choose a different password.");
      return;
    }
    if (newPassword !== form.get("confirmation")) {
      setError("The new passwords do not match.");
      return;
    }
    setPending(true);
    setError("");
    try {
      const result = await authClient.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions: true,
      });
      if (result.error) {
        setError(result.error.message ?? "Unable to change password.");
        return;
      }
      window.location.assign("/portal");
    } catch {
      setError("Unable to connect. Please try again.");
    } finally {
      setPending(false);
    }
  }
  return (
    <main className="flex min-h-svh flex-col bg-background px-6 py-6 md:px-10 md:py-8">
      <div className="mx-auto w-full max-w-md">
        <BrandLogo priority />
      </div>
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-12">
        <div className="border-t-2 border-foreground pt-7">
          <span aria-hidden className="block h-0.5 w-7 bg-ink-accent" />
          <h1 className="mt-4 text-3xl leading-[1.1] font-semibold tracking-tight text-foreground md:text-4xl">
            Choose your password
          </h1>
          <p className="mt-3 max-w-[46ch] text-[0.9375rem] leading-relaxed text-muted-foreground">
            Replace the temporary password from your welcome email to open your customer portal.
          </p>
        </div>
        <form method="post" onSubmit={submit} className="mt-10">
          <FieldGroup className="gap-7">
            <Field>
              <FieldLabel htmlFor="current-password" className={labelType}>
                Temporary password
              </FieldLabel>
              <Input
                id="current-password"
                name="currentPassword"
                type="password"
                autoComplete="current-password"
                required
                maxLength={128}
                className={ruledInput}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="new-password" className={labelType}>
                New password
              </FieldLabel>
              <Input
                id="new-password"
                name="newPassword"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                maxLength={128}
                className={ruledInput}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="confirm-password" className={labelType}>
                Confirm new password
              </FieldLabel>
              <Input
                id="confirm-password"
                name="confirmation"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                maxLength={128}
                className={ruledInput}
              />
            </Field>
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <Button type="submit" size="lg" disabled={pending} className="mt-1 w-full">
              {pending ? "Updating…" : "Update password"}
            </Button>
          </FieldGroup>
        </form>
      </div>
    </main>
  );
}
