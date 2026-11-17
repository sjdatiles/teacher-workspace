/** Result shape shared by all server actions that back a form. */
export type FormState =
  | { ok?: undefined }
  | { ok: true; message: string }
  | {
      ok: false;
      errors: Record<string, string>;
      /** Non-blocking problems (e.g. schedule clashes). The form may resubmit with confirm=1. */
      warnings?: string[];
    };

export function fieldErrors(error: { issues: { path: PropertyKey[]; message: string }[] }) {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}
