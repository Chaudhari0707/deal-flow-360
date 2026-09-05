CREATE TABLE "customer_invitations" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_id" text NOT NULL,
	"user_id" text NOT NULL,
	"created_by" text NOT NULL,
	"encrypted_payload" text NOT NULL,
	"recipient" text NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"provider_id" text,
	"error" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customer_invitations_customer_id_unique" UNIQUE("customer_id")
);
--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "must_change_password" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "customer_invitations" ADD CONSTRAINT "customer_invitations_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_invitations" ADD CONSTRAINT "customer_invitations_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_invitations" ADD CONSTRAINT "customer_invitations_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;