ALTER TABLE "invoice_deliveries" DROP CONSTRAINT "invoice_deliveries_order_id_orders_id_fk";
--> statement-breakpoint
ALTER TABLE "invoice_deliveries" ADD CONSTRAINT "invoice_deliveries_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;