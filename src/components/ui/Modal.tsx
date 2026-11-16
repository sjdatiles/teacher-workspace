"use client";

import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";

type ModalProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
};

/** Accessible modal built on the native <dialog> (focus trap, Esc to close). */
export function Modal({ open, title, onClose, children }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-labelledby="modal-title"
      className="rounded-card bg-surface shadow-pop backdrop:bg-ink/40 m-auto w-[min(32rem,calc(100vw-2rem))] p-0"
    >
      <div className="border-line flex items-center justify-between border-b px-5 py-4">
        <h2 id="modal-title" className="text-lg font-bold">
          {title}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="rounded-control text-ink-soft hover:bg-brand-100/60 grid size-9 place-items-center"
        >
          <X className="size-5" aria-hidden />
        </button>
      </div>
      <div className="p-5">{children}</div>
    </dialog>
  );
}
