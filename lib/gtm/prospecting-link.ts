/**
 * The account a link opens in Prospecting: `/gtm/prospecting?account=<id>` (a signal's "Open in Prospecting"). Only a whole number above zero is an account; anything
 * else in the address is ignored, so the address can never open a record by accident.
 */
export function accountFromSearch(search: string): number | null {
  const raw = new URLSearchParams(search).get('account')
  if (raw === null || !/^[1-9]\d{0,9}$/.test(raw)) return null
  return Number(raw)
}
