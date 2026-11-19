/** Set when a reset email is requested (1 hour): tells /auth/callback the next link is a reset. */
export const RECOVERY_COOKIE = "tw-recovery";
/** Set by /auth/callback after a reset link was exchanged (15 min): required to use /reset-password. */
export const RESET_ALLOWED_COOKIE = "tw-reset-allowed";
