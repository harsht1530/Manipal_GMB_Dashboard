/**
 * Login branch -> the branch name the monthly (Dashboard) data uses, where the two differ.
 * The allocation sheet names folder "MH - Dwarka" as unit "Delhi", and so does the monthly
 * data, but that unit's login was created as "Dwarka". Every other login already matches.
 * The realtime pages resolve branches on the backend (realtime/cluster-folders.js) instead.
 */
const LEGACY_BRANCH_ALIASES: Record<string, string> = {
  dwarka: "Delhi",
};

export const legacyBranchOf = (branch?: string | null): string => {
  const value = (branch || "").trim();
  return LEGACY_BRANCH_ALIASES[value.toLowerCase()] ?? value;
};
