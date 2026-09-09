const KEY = 'gtg-last-visited'

/**
 * The last page somebody was on, for the "land where I left off" preference.
 *
 * ── WHY THIS ONE IS DELIBERATELY PER-DEVICE ─────────────────────────────────
 *
 * Everything else in Preferences is stored on the account so it follows the
 * person. This is not, and that is the correct answer rather than a shortcut:
 * "the last page I was on" means the last page on THIS machine. Syncing it
 * would land somebody on the screen they had open at home when they sign in at
 * work, which is not what the setting says and not what anybody wants.
 *
 * The PREFERENCE — whether to do this at all — is on the account and does
 * follow them. Only the remembered path is local.
 */

/** Paths that must never be landed on. */
const NEVER_LAND = ['/login', '/set-password', '/logout']

export function rememberLastVisited(path: string) {
  if (!path.startsWith('/') || NEVER_LAND.some((p) => path.startsWith(p))) return

  try {
    window.localStorage.setItem(KEY, path)
  } catch {
    // Site data blocked. The landing preference simply falls back to the
    // dashboard, which is what it would do with nothing remembered anyway.
  }
}

/**
 * Where to land, or null when there is nothing safe to return to.
 *
 * The path is re-validated on the way out as well as in: it is read back from
 * storage the browser's owner can edit, and it is about to be handed to
 * `router.push`. A value starting with `//` is an absolute URL to another host,
 * which is how a stored preference becomes an open redirect.
 */
export function readLastVisited(): string | null {
  try {
    const value = window.localStorage.getItem(KEY)

    if (!value || !value.startsWith('/') || value.startsWith('//')) return null
    if (NEVER_LAND.some((p) => value.startsWith(p))) return null

    return value
  } catch {
    return null
  }
}
