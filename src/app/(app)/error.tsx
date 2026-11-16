"use client";

import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";

/** Shown when a page fails to load its data, instead of pretending the data is empty. */
export default function AppError({ reset }: { error: Error; reset: () => void }) {
  return (
    <Card>
      <EmptyState
        icon={<TriangleAlert className="size-8" aria-hidden />}
        title="Something went wrong"
        description="We couldn't load this page. Check your connection and try again."
        action={<Button onClick={reset}>Try again</Button>}
      />
    </Card>
  );
}
