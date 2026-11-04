/**
 * Drops every session and refresh token of a business-managed account. It runs on its own statement,
 * never inside the caller's transaction: it must happen AFTER the external auth call it follows.
 */
export interface SessionRevocationPort {
  revokeSessions(userId: string): Promise<void>;
}
