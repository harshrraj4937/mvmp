export const ADMIN_ROLE = "admin";

/** better-auth's admin plugin stores roles as a comma-separated list. */
export function isAdmin(user: { role?: null | string }): boolean {
  return (user.role ?? "")
    .split(",")
    .map((role) => role.trim())
    .includes(ADMIN_ROLE);
}
