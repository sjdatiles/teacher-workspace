"use client";

import type { ReactNode } from "react";
import { Button } from "./Button";
import { Modal } from "./Modal";

/** Confirmation before a destructive action. Mount it only while it should be open. */
export function ConfirmModal({
  title,
  children,
  confirmLabel,
  pending,
  onConfirm,
  onClose,
}: {
  title: string;
  children: ReactNode;
  confirmLabel: string;
  pending?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal open onClose={onClose} title={title}>
      <div className="text-ink-soft space-y-4 text-sm">{children}</div>
      <div className="mt-5 flex justify-end gap-3">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="danger" loading={pending} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
