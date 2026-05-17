/** Roles that skip referral withdrawal caps and may receive uplink income regardless of user `status`. */
export const REFERRAL_STAFF_ROLES = new Set(["super_admin", "admin", "moderator"]);

export function isReferralStaffRole(role: unknown): boolean {
  return typeof role === "string" && REFERRAL_STAFF_ROLES.has(role);
}
