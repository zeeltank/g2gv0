import type { ActionContext, ActionValues, ChatActionDefinition } from './types'

/**
 * The actions an application offers, and how a sentence or a page picks among them.
 *
 * Nothing is global: an application builds its own registry from its own definitions, so an
 * action that exists in one application cannot be matched, offered or run in another.
 */
export class ActionRegistry<App = unknown> {
  private readonly definitions: ChatActionDefinition<App>[]

  constructor(definitions: ChatActionDefinition<App>[]) {
    this.definitions = definitions
  }

  get(key: string): ChatActionDefinition<App> | undefined {
    return this.definitions.find((definition) => definition.key === key)
  }

  /** The actions that belong on the page the user is on. */
  available(context: ActionContext<App>): ChatActionDefinition<App>[] {
    return this.definitions.filter((definition) => definition.appliesTo(context))
  }

  /**
   * The action a sentence asks for, among those available on this page.
   *
   * A match needs one of the action's phrases in the sentence as whole words; the longest
   * phrase wins so "create department head" is not mistaken for "create department". Only
   * actions available HERE are considered - asking for something this page does not offer
   * matches nothing, and the question goes to the assistant as an ordinary question.
   */
  match(message: string, context: ActionContext<App>): ChatActionDefinition<App> | null {
    const text = ` ${normalise(message)} `
    let best: { definition: ChatActionDefinition<App>; length: number } | null = null

    for (const definition of this.available(context)) {
      for (const phrase of definition.phrases) {
        const needle = ` ${normalise(phrase)} `

        if (text.includes(needle) && (best === null || needle.length > best.length)) {
          best = { definition, length: needle.length }
        }
      }
    }

    return best?.definition ?? null
  }
}

function normalise(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/**
 * Values the sentence already states: "... called Finance" fills the first required text field.
 *
 * Deliberately modest - one pattern, one field. It saves typing the obvious; anything it does
 * not catch is simply asked for on the form, and the user sees every value before confirming.
 */
export function prefillFromMessage(definition: ChatActionDefinition<never>, message: string): ActionValues {
  const named = /\b(?:called|named|titled)\s+["“']?(.+?)["”']?\s*$/i.exec(message.trim())
  const target = definition.inputs.find((input) => input.type === 'text' && input.required)

  return named && target ? { [target.key]: named[1].trim() } : {}
}
