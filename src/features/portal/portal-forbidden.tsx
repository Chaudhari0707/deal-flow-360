import Link from "next/link";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

/**
 * Portal refusal. `Alert` is already a rule-and-text note, so this surface only holds the message
 * to a readable measure and gives its single recovery action room to stand on its own.
 */
export function PortalForbidden() {
  return (
    <Alert variant="destructive" className="max-w-[60ch] py-1">
      <AlertTitle className="text-base">Customer portal only</AlertTitle>
      <AlertDescription>
        <span className="block leading-relaxed">
          This portal is reserved for customer accounts and scoped quotation links.
        </span>
        <div className="mt-5">
          <Button nativeButton={false} render={<Link href="/dashboard" />}>
            Go to workspace
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
