"use client";

import { useEffect } from "react";

/**
 * Pages opened with "?new=1" (the Home quick actions) start with their add form open.
 * This removes the flag from the address afterwards so a refresh does not reopen the form.
 */
export function useClearNewParam(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const url = new URL(window.location.href);
    if (!url.searchParams.has("new")) return;
    url.searchParams.delete("new");
    window.history.replaceState(
      window.history.state,
      "",
      `${url.pathname}${url.search}${url.hash}`,
    );
  }, [active]);
}
