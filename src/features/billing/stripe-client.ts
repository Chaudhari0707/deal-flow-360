import "server-only";

import Stripe from "stripe";

import { DomainError } from "@/server/errors";

let client: Stripe | null = null;

export function stripePublishableKey() {
  const key = Bun.env.STRIPE_PUBLISHABLE_KEY?.trim();
  if (!key) throw new DomainError("Stripe publishable key is not configured", 503);
  return key;
}

export function stripeSecretKey() {
  const key = Bun.env.STRIPE_SECRET_KEY?.trim();
  if (!key) throw new DomainError("Stripe secret key is not configured", 503);
  return key;
}

export function stripeWebhookSecret() {
  const key = Bun.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!key) throw new DomainError("Stripe webhook secret is not configured", 503);
  return key;
}

export function stripeClient() {
  if (!client) client = new Stripe(stripeSecretKey());
  return client;
}

export function appOrigin() {
  const base = Bun.env.BETTER_AUTH_URL?.trim();
  if (!base) throw new DomainError("BETTER_AUTH_URL is not configured", 503);
  return new URL(base).origin;
}
