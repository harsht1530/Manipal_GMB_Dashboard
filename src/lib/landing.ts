/**
 * Where a signed-in user starts.
 *
 * Kept in one place because four paths send people here: the two login flows, the guard
 * that bounces an already-signed-in user off /login, and the bare "/" URL. They all have
 * to agree, and "/" matters as much as the login flows - a returning user with a live
 * session opens the app at "/" and never sees the login page at all.
 *
 * The dashboard moved to /dashboard and is still in the sidebar; it is simply no longer
 * the first thing shown.
 */
export const LANDING_ROUTE = "/realtime";
