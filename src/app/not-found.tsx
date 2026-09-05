import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function NotFound() {
  return (
    <main className="flex min-h-svh items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>We couldn't find that page</CardTitle>
          <CardDescription>
            The link may have changed or the item may no longer be available.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button nativeButton={false} render={<Link href="/dashboard" />}>
            Back to workspace
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
