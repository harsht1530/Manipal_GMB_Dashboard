/**
 * Who may see the Profile Optimization report.
 *
 * One list, used by the sidebar (to hide the entry), the page itself (to refuse a direct URL)
 * and - mirrored in backend/realtime/routes.js - by the API. Keep the two in step: the sidebar
 * only decides what is shown, the backend decides what is served.
 *
 * Addresses are compared lower-cased and trimmed, since the login form does not normalise them.
 */
export const OPTIMIZATION_EMAILS = ["harsh@multipliersolutions.com"];

export const canSeeOptimization = (email?: string | null): boolean =>
  !!email && OPTIMIZATION_EMAILS.includes(email.trim().toLowerCase());
