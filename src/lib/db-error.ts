/** Minimal shape of a Supabase/PostgREST error. */
export type DbError = { code?: string; message?: string } | null | undefined;

/**
 * Turns a database error into a sentence a teacher can act on.
 * Messages raised on purpose by our own SQL functions and triggers (check_violation)
 * are already written for teachers and are passed through; raw constraint text is not.
 */
export function friendlyDbError(error: DbError, fallback: string): string {
  if (!error) return fallback;
  const message = error.message ?? "";
  switch (error.code) {
    case "23514":
      return message && !/violates check constraint/i.test(message) ? message : fallback;
    case "23505":
      return "That already exists.";
    case "23503":
      return "This is still used by a schedule or session, so it cannot be changed or removed that way.";
    case "P0002":
      return "That record no longer exists. Refresh the page and try again.";
    case "28000":
    case "42501":
      return "Your session has expired. Please sign in again.";
    default:
      return fallback;
  }
}
