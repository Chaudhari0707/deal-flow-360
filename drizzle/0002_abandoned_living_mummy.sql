ALTER TABLE "account" ADD COLUMN "issuer" text;--> statement-breakpoint
UPDATE "account" SET "issuer" = 'local:credential', "account_id" = "user_id" WHERE "provider_id" = 'credential';--> statement-breakpoint
ALTER TABLE "account" ALTER COLUMN "issuer" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "price_basis_cents" integer;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "price_basis_quantity" integer;--> statement-breakpoint
UPDATE "subscriptions" SET "price_basis_cents" = "period_net_cents", "price_basis_quantity" = "quantity";--> statement-breakpoint
ALTER TABLE "subscriptions" ALTER COLUMN "price_basis_cents" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "subscriptions" ALTER COLUMN "price_basis_quantity" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "account_issuer_accountId_uidx" ON "account" USING btree ("issuer","account_id");
