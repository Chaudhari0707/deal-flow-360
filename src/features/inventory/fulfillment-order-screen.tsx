"use client";

import { useRouter } from "next/navigation";

import { FulfillmentDetail } from "@/features/inventory/fulfillment-detail";
import { useStockFeed } from "@/features/inventory/use-stock-feed";

export function FulfillmentOrderScreen({ id }: { id: string }) {
  const router = useRouter();
  useStockFeed();
  return <FulfillmentDetail id={id} back={() => router.push("/fulfillment")} />;
}
