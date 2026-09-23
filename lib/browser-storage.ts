/**
 * EVERY KEY THIS PRODUCT KEEPS IN THE BROWSER, IN ONE PLACE.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHY THIS FILE EXISTS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Sign-out used to clear four keys. The product writes fourteen. The nine it left
 * behind were each a value the NEXT person to sign in on that browser would
 * silently inherit:
 *
 *   gtg-last-visited                     user B is redirected to the page user A
 *                                        last had open
 *   gtg-theme                            user B gets user A's light/dark choice
 *   gtg-device-id                        never cleared; `clearDeviceId()` was
 *                                        written and called from nowhere
 *   agentic:agent-draft:*                user B sees user A's unsaved draft
 *   hrit.leave-reports.saved             user A's saved report filters
 *   hrit.leave-requests.hidden-columns   user A's column choices
 *   cm-competency-library:saved-views    user A's saved views
 *   cm-audit:display-settings            user A's display settings
 *   task-assign:last-used                user A's last department and job role
 *   pendingTasksCount                    a global counter shared by everyone
 *
 * On a shared machine — a reception desk, an HR workstation, a demo laptop —
 * every one of those crosses between people. Two of them (`agent-draft` and
 * `leave-reports.saved`) can hold real business content.
 *
 * ── THE POINT IS THAT THERE IS ONE LIST ─────────────────────────────────────
 *
 * Before this, `logout()` had its own four keys inline and
 * `saved-views-section.tsx` had its own five hard-coded for a manual "Clear"
 * button. Two lists, neither complete, and no reason for anyone adding a twelfth
 * key to find either. The next person who calls `localStorage.setItem` adds one
 * entry HERE, and both sign-out and that screen pick it up.
 *
 * ── WHAT IS DELIBERATELY *NOT* CLEARED ──────────────────────────────────────
 *
 * Nothing, currently. Every entry below is per-person or per-browser convenience
 * with no value worth keeping across a change of user. If something ever does
 * need to survive — a genuinely machine-level setting, say — it belongs in
 * `KEPT_ON_SIGN_OUT` with a sentence saying why, rather than being quietly
 * omitted from this list.
 */

/** What owns a key, so the Saved-views screen can name it to a person. */
export interface BrowserKey {
  key: string
  /** Shown in Settings → Saved views. Empty for keys that are pure plumbing. */
  label?: string
  /** The screen that writes it. */
  where?: string
  /** True when the key name is a PREFIX and the real keys are suffixed. */
  prefix?: boolean
}

/**
 * Cleared on sign-out. Ordered roughly by how surprising it would be to inherit.
 */
export const CLEARED_ON_SIGN_OUT: BrowserKey[] = [
  /* ── identity and session ──────────────────────────────────────────────── */
  { key: 'gtg-session', where: 'Sign-in' },
  { key: 'userData', where: 'Sign-in' },
  {
    /*
     * Whether "Keep me signed in" was ticked. Cleared because it is a
     * decision about ONE sign-in, not a standing preference — leaving it
     * behind would hand the next person at a shared machine the last
     * person's answer, and the conservative default (unticked) is the one
     * worth defaulting back to.
     */
    key: 'gtg-remember',
    where: 'Sign-in',
  },
  {
    /*
     * Per-browser by design — it scopes theme and sidebar preferences to THIS
     * machine, which is why it is not per-user. It is still cleared: keeping it
     * would tie two different people's device-scoped preferences to one id, and a
     * fresh one costs nothing (the server writes the account default for an id it
     * has not seen).
     */
    key: 'gtg-device-id',
    where: 'This browser',
  },
  { key: 'gtg-sidebar-expand-on-first-open', where: 'Sidebar' },

  /* ── where you were and how it looked ──────────────────────────────────── */
  { key: 'gtg-last-visited', label: 'Last page you were on', where: 'Navigation' },
  { key: 'gtg-theme', label: 'Theme', where: 'Appearance' },

  /* ── views, filters and columns somebody chose ─────────────────────────── */
  { key: 'cm-competency-library:saved-views', label: 'Saved views', where: 'Competency library' },
  { key: 'cm-audit:display-settings', label: 'Display settings', where: 'Competency audit' },
  { key: 'hrit.leave-reports.saved', label: 'Saved reports', where: 'Leave reports' },
  {
    key: 'hrit.leave-requests.hidden-columns',
    label: 'Hidden columns',
    where: 'Leave requests',
  },
  { key: 'task-assign:last-used', label: 'Last used department and role', where: 'Assign a task' },

  /* ── unfinished work and counters ──────────────────────────────────────── */
  {
    // `agentic:agent-draft:new` plus one per agent being edited, so this matches
    // on the prefix rather than naming every id.
    key: 'agentic:agent-draft:',
    label: 'Unsaved agent drafts',
    where: 'Create an agent',
    prefix: true,
  },
  { key: 'pendingTasksCount', where: 'Tasks' },
  {
    // `notifications_<userId>` — already per-user, but a signed-out browser has no
    // business holding anybody's notifications.
    key: 'notifications_',
    where: 'Tasks',
    prefix: true,
  },
]

/** The subset worth showing a person in Settings → Saved views. */
export const LISTABLE_KEYS = CLEARED_ON_SIGN_OUT.filter((entry) => entry.label)

/**
 * Remove everything in `CLEARED_ON_SIGN_OUT` from both storages.
 *
 * Every access is wrapped: a browser with site data blocked throws on the mere
 * act of reading `localStorage`, and sign-out must succeed regardless — failing
 * to clear a saved view is a far better outcome than being unable to sign out.
 */
export function clearBrowserStateOnSignOut(): void {
  if (typeof window === 'undefined') return

  for (const store of [window.localStorage, window.sessionStorage]) {
    try {
      // Snapshot the names first: removing while iterating the live key list
      // shifts the indices and silently skips entries.
      const names: string[] = []

      for (let i = 0; i < store.length; i += 1) {
        const name = store.key(i)
        if (name !== null) names.push(name)
      }

      for (const name of names) {
        const matched = CLEARED_ON_SIGN_OUT.some((entry) =>
          entry.prefix ? name.startsWith(entry.key) : name === entry.key,
        )

        if (matched) store.removeItem(name)
      }
    } catch {
      // Storage unavailable or blocked. Nothing to clear, nothing to report.
    }
  }
}
