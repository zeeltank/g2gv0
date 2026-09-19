const KEY = 'gtg-device-id'

/**
 * THIS BROWSER'S IDENTITY, FOR PREFERENCES ONLY.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHAT THIS IS, AND WHAT IT IS EMPHATICALLY NOT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * It names a MACHINE, never a person. The server resolves who is calling from
 * the token and nothing else; this only answers "which of their screens is
 * this", so that a laptop and a phone can hold different themes.
 *
 * It is therefore not a secret and not a credential. Somebody who copies another
 * person's device id gains nothing — the preferences they read back are still
 * their own, because the rows are keyed by user first. That is proved in
 * `prove-device-preferences.php` §8.
 *
 * It is also not a fingerprint. Nothing is derived from the browser, the screen,
 * the fonts or the clock; it is a random value this browser generated about
 * itself and can throw away.
 *
 * ── LOSING IT IS A DESIGNED-FOR OUTCOME, NOT A FAILURE ──────────────────────
 *
 * Clearing site data loses the id. That is unavoidable — a wiped browser is a
 * new browser — and it is precisely why the preferences live on the SERVER
 * rather than in localStorage. Without an id the server falls back to the
 * person's account default, so they land on their own settings rather than on
 * factory ones. The old behaviour, where everything reverted, is exactly the bug
 * this was built to fix.
 */

/**
 * A ULID-shaped identifier: 26 characters, Crockford base32, time-ordered.
 *
 * Hand-rolled rather than adding a dependency for one function. The timestamp
 * prefix is not load-bearing — nothing sorts these — but it makes a row in
 * `user_preferences` legible when somebody is debugging which device is which.
 */
function mint(): string {
  const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

  let time = Date.now()
  let timeChars = ''

  for (let i = 0; i < 10; i++) {
    timeChars = ALPHABET[time % 32] + timeChars
    time = Math.floor(time / 32)
  }

  /*
   * `crypto.getRandomValues` where it exists, which is every browser this
   * product supports. The `Math.random` path is not a security fallback — it is
   * there so a server render or an exotic runtime cannot throw on a value that
   * only labels a screen.
   */
  const bytes = new Uint8Array(16)

  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes)
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256)
  }

  let randomChars = ''
  for (let i = 0; i < 16; i++) randomChars += ALPHABET[bytes[i] % 32]

  return timeChars + randomChars
}

/**
 * This browser's id, minting one on first use.
 *
 * Returns an empty string when storage is unavailable — a private window, or a
 * browser with site data blocked. The server reads an empty id as "no device",
 * so those visitors get their account defaults and everything still works. They
 * simply cannot hold a per-device override, which is the honest outcome for a
 * browser that has told us it will not remember anything.
 *
 * The server's own guard (`AccountController::deviceId`) accepts only
 * `[A-Za-z0-9_-]{1,40}` and treats anything else as absent, so a corrupted
 * stored value degrades the same way rather than reaching the unique index.
 */
export function getDeviceId(): string {
  if (typeof window === 'undefined') return ''

  try {
    const existing = window.localStorage.getItem(KEY)

    if (existing && /^[A-Za-z0-9_-]{1,40}$/.test(existing)) return existing

    const fresh = mint()
    window.localStorage.setItem(KEY, fresh)

    return fresh
  } catch {
    return ''
  }
}

/** Forget this browser's identity, so it follows the account default again. */
export function clearDeviceId(): void {
  try {
    window.localStorage.removeItem(KEY)
  } catch {
    // Nothing stored, nothing to clear.
  }
}