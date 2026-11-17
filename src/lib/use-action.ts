"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import type { FormState } from "./form-state";

export type Notice = { tone: "success" | "error"; text: string } | null;

/** Runs a server action from a button and keeps its result as a page notice. */
export function useRunAction() {
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<Notice>(null);

  function run(action: () => Promise<FormState>, onOk?: () => void) {
    startTransition(async () => {
      const res = await action();
      if (res.ok === true) {
        setNotice({ tone: "success", text: res.message });
        onOk?.();
      } else if (res.ok === false) {
        setNotice({
          tone: "error",
          text: res.errors.form ?? Object.values(res.errors)[0] ?? "Something went wrong.",
        });
      }
    });
  }
  return {
    run,
    pending,
    notice,
    clear: () => setNotice(null),
    show: (text: string) => setNotice({ tone: "success", text }),
  };
}

/** Calls onSuccess(message) once each time a form action succeeds. */
export function useOnSuccess(state: FormState, onSuccess: (message: string) => void) {
  const latest = useRef(onSuccess);
  useEffect(() => {
    latest.current = onSuccess;
  });
  useEffect(() => {
    if (state.ok === true) latest.current(state.message);
  }, [state]);
}
