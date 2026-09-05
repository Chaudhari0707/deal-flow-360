import Link from "next/link";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export function PortalForbidden() {
  return (
    <Alert variant="destructive">
      <AlertTitle>Customer portal only</AlertTitle>
      <AlertDescription>
        This portal is reserved for customer accounts and scoped quotation links.
        <div className="mt-4">
          <Button nativeButton={false} render={<Link href="/dashboard" />}>
            Go to workspace
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
