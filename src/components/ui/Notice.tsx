import clsx from "clsx";
import { CheckCircle2, X, XCircle } from "lucide-react";
import type { Notice } from "@/lib/use-action";

/** Result of an action, announced to screen readers. */
export function NoticeBar({ notice, onClose }: { notice: Notice; onClose: () => void }) {
  if (!notice) return <div aria-live="polite" />;
  const ok = notice.tone === "success";
  return (
    <div
      role={ok ? "status" : "alert"}
      className={clsx(
        "rounded-control mb-4 flex items-start gap-2.5 px-3.5 py-2.5 text-sm font-medium",
        ok ? "bg-success-50 text-success-500" : "bg-danger-50 text-danger-500",
      )}
    >
      {ok ? (
        <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
      ) : (
        <XCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
      )}
      <span className="flex-1">{notice.text}</span>
      <button type="button" onClick={onClose} aria-label="Dismiss" className="shrink-0">
        <X className="size-4" aria-hidden />
      </button>
    </div>
  );
}
