export const SUPER_ADMIN_EMAILS = ['christianferbol@gmail.com', 'admin@watermelon.app']

export function isSuperAdmin(email: string) {
  return SUPER_ADMIN_EMAILS.includes(email.toLowerCase().trim())
}
