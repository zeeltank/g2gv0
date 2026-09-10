import {
  Bell,
  Blocks,
  Bookmark,
  Building2,
  KeyRound,
  ScrollText,
  ShieldCheck,
  Send,
  Sliders,
  UserRound,
  Users,
  type LucideIcon,
} from 'lucide-react'

/**
 * EVERY SETTINGS SECTION, AND WHO SEES IT.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ROLE GATING HERE IS PRESENTATION, AND ONLY PRESENTATION
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * A section absent from somebody's rail is not a security control. Every
 * endpoint behind these screens is guarded server-side - `/api/account/*` takes
 * its subject from the token and accepts no user id at all, and the
 * administrator sections sit behind `profile:admin,hr`. Somebody who edits this
 * array in their own browser gains a menu entry and nothing else.
 *
 * The reason to gate at all is that eleven sections shown to an employee, nine
 * of which refuse them, is a worse screen than five that all work.
 *
 * ── THE ROLE VOCABULARY IS THE BACKEND'S ────────────────────────────────────
 *
 * `RoleKey::ALL` - employee, reporting_manager, department_head, hr_executive,
 * hr_manager, administrator, executive, auditor, recruiter. Nine, and the API
 * reports which one you are on `/account/me`. Anything unrecognised (a profile
 * that predates `role_key` and has no legacy mapping) falls back to the
 * personal sections, because everybody has a name and a password.
 */

export type SettingsSectionId =
  | 'profile'
  | 'security'
  | 'preferences'
  | 'notifications'
  | 'saved-views'
  | 'people'
  | 'delivery'
  | 'organization'
  | 'roles'
  | 'policy'
  | 'audit'
  | 'modules'

export type SettingsSection = {
  id: SettingsSectionId
  label: string
  /** One line, shown under the label in the rail. Says what the section CHANGES. */
  blurb: string
  icon: LucideIcon
  group: 'You' | 'Organisation'
  /** null = everybody. Otherwise the role_keys that see it. */
  roles: string[] | null
  /** Not yet built. Listed, disabled, and labelled - never a link to nothing. */
  soon?: boolean
}

const ADMIN = ['administrator', 'hr_manager', 'hr_executive']
const ADMIN_ONLY = ['administrator']

export const SETTINGS_SECTIONS: SettingsSection[] = [
  // ── Everybody ─────────────────────────────────────────────────────────────
  {
    id: 'profile',
    label: 'Profile',
    blurb: 'Your name, contact details and photo',
    icon: UserRound,
    group: 'You',
    roles: null,
  },
  {
    id: 'security',
    label: 'Sign-in & security',
    blurb: 'Password and the devices you are signed in on',
    icon: KeyRound,
    group: 'You',
    roles: null,
  },
  {
    id: 'preferences',
    label: 'Preferences',
    blurb: 'Theme, language, dates and where you land',
    icon: Sliders,
    group: 'You',
    roles: null,
  },
  {
    id: 'notifications',
    label: 'Notifications',
    blurb: 'Which events email you, one by one',
    icon: Bell,
    group: 'You',
    roles: null,
  },
  {
    id: 'saved-views',
    label: 'Saved views',
    blurb: 'Filters and columns you have kept',
    icon: Bookmark,
    group: 'You',
    roles: null,
  },

  // ── Administrator / HR ────────────────────────────────────────────────────
  {
    id: 'people',
    label: 'People & access',
    blurb: 'Invitations, and anyone who has never signed in',
    icon: Users,
    group: 'Organisation',
    roles: ADMIN,
  },
  {
    id: 'delivery',
    label: 'Email & SMS',
    blurb: 'How this organisation sends anything at all',
    icon: Send,
    group: 'Organisation',
    roles: ADMIN,
  },
  {
    id: 'modules',
    label: 'Modules',
    blurb: 'Which parts of the product are switched on',
    icon: Blocks,
    group: 'Organisation',
    /*
     * ADMIN_ONLY, matching the guard rather than the intuition.
     *
     * This read `ADMIN` - administrator, hr_manager, hr_executive - but both
     * endpoints behind it are `->middleware('profile:admin')` (routes/api.php
     * :1133-1134), and `RoleKey::ALIASES['admin']` is `['administrator']` alone.
     * So an HR manager saw the section, and the screen answered "Modules cannot
     * be configured from this account" - a rail entry whose only content is a
     * refusal.
     *
     * Widening the routes instead would be a permissions decision, not a fix.
     */
    roles: ADMIN_ONLY,
  },
  {
    id: 'organization',
    label: 'Organisation defaults',
    blurb: 'Working week, financial year, currency, formats',
    icon: Building2,
    group: 'Organisation',
    /*
     * ADMIN_ONLY, for the same reason `modules` above is.
     *
     * Both endpoints behind this are `->middleware('profile:admin')`, and
     * `RoleKey::ALIASES['admin']` is `['administrator']` alone - so an HR
     * manager listed here got a rail entry whose only content was a refusal.
     * The Modules entry had already been corrected for exactly this; this one
     * was missed, which is what a second review is for.
     *
     * `delivery` stays ADMIN deliberately: its routes are `profile:admin,hr`,
     * so HR really can reach it.
     */
    roles: ADMIN_ONLY,
  },
  {
    id: 'roles',
    label: 'Roles & access',
    blurb: 'What each role can reach, and what it sees first',
    icon: ShieldCheck,
    group: 'Organisation',
    roles: ADMIN_ONLY,
  },
  {
    id: 'policy',
    label: 'Security policy',
    blurb: 'Password rules, session length, sign-in by OTP',
    icon: ShieldCheck,
    group: 'Organisation',
    roles: ADMIN_ONLY,
  },
  {
    id: 'audit',
    label: 'Audit',
    blurb: 'What changed, when, and who did it',
    icon: ScrollText,
    group: 'Organisation',
    roles: [...ADMIN_ONLY, 'auditor'],
  },
]

/** The sections one role sees, in rail order. */
export function sectionsForRole(role: string | null): SettingsSection[] {
  return SETTINGS_SECTIONS.filter((section) => {
    if (section.roles === null) return true
    if (!role) return false

    return section.roles.includes(role)
  })
}

export function isSectionId(value: string | null): value is SettingsSectionId {
  return SETTINGS_SECTIONS.some((section) => section.id === value)
}
