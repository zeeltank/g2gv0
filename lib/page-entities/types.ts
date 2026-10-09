/**
 * Page entities: finding and opening a real record from the chat - "show this person's document",
 * "open the Form 16", "find the leave request for ...".
 *
 * Application-agnostic. This file names no page, table, endpoint or record type. An application
 * supplies PROVIDERS - one per kind of record a page lists - and the same resolver, the same
 * answer shape and the same "one match opens, several matches are listed for the user to choose"
 * rule work for every one of them.
 *
 * THE RULES THE RESOLVER ENFORCES (see `resolve.ts`)
 *
 *   - Only providers that apply to the page the user is on are consulted.
 *   - Exactly one match: it is opened. Several: ALL are shown, none is opened for the user.
 *     None: the user is told nothing matched - never a near miss presented as the answer.
 *   - A provider may ask a question back (`clarify`) when the request names no one.
 *   - Search runs as the signed-in user through the application's own API, so what comes back is
 *     exactly what the user is already allowed to see.
 */

/** Where the user is, as the application resolved it. `App` is whatever the application adds. */
export interface EntityContext<App = unknown> {
  pathname: string
  menuId: number | null
  moduleKey: string | null
  app: App
}

/** One record the user could mean, with enough to tell it apart from the others. */
export interface EntityMatch {
  /** The record's own id, as a string. */
  id: string
  title: string
  /** Usually who or what it belongs to. */
  subtitle?: string
  /** Everything else that helps pick the right one: type, date, file name... */
  details: Array<{ label: string; value: string }>
}

/** What the sentence asked for, in words the user can check. */
export interface EntityQuery {
  /** Provider-specific terms, kept opaque to the resolver. */
  terms: Record<string, string>
  /** "documents of Rahul Patel" - shown back to the user so a wrong reading is obvious. */
  summary: string
}

/** The provider needs more from the user before it can search. */
export interface EntityClarify {
  question: string
  /** Real values the user can pick, each sent back as a message. */
  choices: Array<{ label: string; message: string }>
}

/** How to open one match. */
export type EntityTarget =
  | { kind: 'navigate'; href: string }
  /** Already on the right page: tell it which record to show. */
  | { kind: 'event'; name: string; detail: Record<string, unknown> }

export interface EntityProvider<App = unknown> {
  key: string
  /** Plural, lower case: "documents". */
  noun: string
  appliesTo: (context: EntityContext<App>) => boolean
  /** The query this sentence asks for, a question back, or null when it is not about these records. */
  parse: (message: string, context: EntityContext<App>) => Promise<EntityQuery | EntityClarify | null> | EntityQuery | EntityClarify | null
  search: (query: EntityQuery, context: EntityContext<App>) => Promise<EntityMatch[]>
  /**
   * Optional. Asked only when `search` found nothing: records that satisfy PART of the request (some of
   * the words). They are offered as a list to choose from and are never opened for the user, because a
   * partial match is a suggestion, not the answer.
   */
  similar?: (query: EntityQuery, context: EntityContext<App>) => Promise<EntityMatch[]>
  /** Questions worth asking on this page, built from the records that really exist. */
  suggestions?: (context: EntityContext<App>) => Promise<string[]>
  open: (match: EntityMatch, context: EntityContext<App>) => EntityTarget
}

export type EntityOutcome =
  | { kind: 'clarify'; providerKey: string; noun: string; clarify: EntityClarify }
  | { kind: 'none'; providerKey: string; noun: string; query: EntityQuery }
  | { kind: 'one'; providerKey: string; noun: string; query: EntityQuery; match: EntityMatch }
  | { kind: 'many'; providerKey: string; noun: string; query: EntityQuery; matches: EntityMatch[] }
  /** Nothing matched the whole request; these match part of it. Always listed, never opened. */
  | { kind: 'similar'; providerKey: string; noun: string; query: EntityQuery; matches: EntityMatch[] }
  | { kind: 'error'; providerKey: string; noun: string; message: string }
