"use client";

import { useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { apiClient, apiData } from "@/lib/api/client";

export function CustomerDelete({
  id,
  name,
  disabled,
  deleted,
}: {
  id: string;
  name: string;
  disabled: boolean;
  deleted: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function remove() {
    setPending(true);
    setError("");
    try {
      apiData(await apiClient.api.v1.customers({ id }).delete());
      await deleted();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not delete customer.");
    } finally {
      setPending(false);
    }
  }
  return (
    <>
      <Button
        type="button"
        variant="destructive"
        disabled={disabled}
        onClick={() => {
          setError("");
          setOpen(true);
        }}
      >
        Delete customer
      </Button>
      <AlertDialog
        open={open}
        onOpenChange={(next) => {
          if (!pending) setOpen(next);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl leading-tight font-semibold tracking-tight text-foreground">
              Delete {name}?
            </AlertDialogTitle>
            <AlertDialogDescription className="max-w-[56ch] leading-relaxed">
              This permanently removes an unused customer. Customers with quotations, billing
              history, or portal accounts cannot be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <AlertDialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={pending}
              onClick={() => void remove()}
            >
              {pending ? "Deleting…" : "Confirm deletion"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
