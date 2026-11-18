/**
 * The link given as the source of an opportunity added by hand. It can be from ANY website or platform; the rules here are the same ones the server
 * applies (a real absolute http(s) address, nothing unsafe), so a refusal is explained before anything is sent. The link is evidence the person
 * supplies: nothing here, or on the server, ever opens it. Pure: no network.
 */

/** The server's column holds 1000 characters. */
export const SOURCE_LINK_MAX = 1000

/** Hostname (without "www.") => the name people know the platform by. Matches the server's list; any other site shows as its own hostname. */
const PLATFORMS: Record<string, string> = {
  'linkedin.com': 'LinkedIn', 'lnkd.in': 'LinkedIn',
  'facebook.com': 'Facebook', 'fb.com': 'Facebook', 'fb.watch': 'Facebook', 'fb.me': 'Facebook',
  'instagram.com': 'Instagram', 'instagr.am': 'Instagram',
  'x.com': 'X (Twitter)', 'twitter.com': 'X (Twitter)', 't.co': 'X (Twitter)',
  'youtube.com': 'YouTube', 'youtu.be': 'YouTube',
}

/** Why a link cannot be used, in plain words, or null when it can. */
export function sourceLinkProblem(raw: string): string | null {
  const v = raw.trim()
  if (v === '') return 'Add the link to the post or page it came from.'
  if (/[\u0000- \u007f]/.test(v)) return 'The link cannot contain spaces. Copy the full address from the address bar.'
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(v)?.[1]?.toLowerCase()
  if (!scheme) return 'Enter a full web link starting with https://'
  if (scheme !== 'http' && scheme !== 'https') return 'Only http:// and https:// links are accepted.'
  if (!/^https?:\/\/[^/?#]/i.test(v)) return 'Enter a full web link starting with https://'
  let u: URL
  try {
    u = new URL(v)
  } catch {
    return 'Enter a full web link starting with https://'
  }
  if (u.username || u.password) return 'The link cannot contain a username or password.'
  const host = u.hostname.replace(/\.$/, '').toLowerCase()
  if (host.startsWith('[') || /^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return 'Use the website address (a name such as example.com), not a numeric IP address.'
  if (!host.includes('.') || !/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/.test(host)) return 'Enter a full web link starting with https://, with a real website name.'
  if (u.href.length > SOURCE_LINK_MAX) return `That link is too long (over ${SOURCE_LINK_MAX} characters). Use the short share link instead.`

  return null
}

/** LinkedIn, Facebook, Instagram, X (Twitter), YouTube for those sites; any other site by its own hostname; null when it is not a usable address. */
export function sourcePlatform(raw: string | null | undefined): string | null {
  if (!raw || sourceLinkProblem(raw) !== null) return null
  const host = new URL(raw.trim()).hostname.replace(/\.$/, '').toLowerCase()
  for (const [domain, label] of Object.entries(PLATFORMS)) {
    if (host === domain || host.endsWith(`.${domain}`)) return label
  }

  return host.replace(/^www\./, '')
}
