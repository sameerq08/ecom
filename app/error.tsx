"use client"; // Error boundaries must be Client Components.

import { useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/ErrorState";

export default function ErrorPage({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <ErrorState
      description="We couldn't load this page. Please try again."
      actions={
        <Button variant="outline" fullWidth onClick={() => retry()}>
          Try again
        </Button>
      }
    />
  );
}
