import type { EntityContext, EntityMatch, EntityOutcome, EntityProvider } from './types'

/**
 * Turn a sentence into an outcome: nothing to do with these records (null), a question back, no
 * match, exactly one match, or several. Pure apart from the provider calls it is handed, so the
 * rules below can be tested without a network.
 *
 * The first applicable provider whose `parse` recognises the sentence owns it; later providers are
 * not consulted, so one sentence can never open two different kinds of record.
 */
export async function resolveEntity<App>(
  message: string,
  providers: Array<EntityProvider<App>>,
  context: EntityContext<App>,
): Promise<EntityOutcome | null> {
  for (const provider of providers) {
    if (!provider.appliesTo(context)) continue

    let parsed
    try {
      parsed = await provider.parse(message, context)
    } catch {
      continue
    }

    if (parsed === null) continue

    if ('question' in parsed) {
      return { kind: 'clarify', providerKey: provider.key, noun: provider.noun, clarify: parsed }
    }

    let matches: EntityMatch[]
    try {
      matches = await provider.search(parsed, context)
    } catch (error) {
      return {
        kind: 'error',
        providerKey: provider.key,
        noun: provider.noun,
        message: error instanceof Error ? error.message : `The ${provider.noun} could not be searched.`,
      }
    }

    // The same record twice (a join that repeats a row) is one record.
    const unique = matches.filter((match, index) => matches.findIndex((other) => other.id === match.id) === index)

    if (unique.length === 0) {
      // Nothing matched the whole request: offer what matches part of it, to choose from.
      if (provider.similar) {
        try {
          const partial = (await provider.similar(parsed, context)).filter((match, index, all) => all.findIndex((other) => other.id === match.id) === index)
          if (partial.length > 0) return { kind: 'similar', providerKey: provider.key, noun: provider.noun, query: parsed, matches: partial }
        } catch {
          // A failed attempt at suggestions is just "no suggestions".
        }
      }

      return { kind: 'none', providerKey: provider.key, noun: provider.noun, query: parsed }
    }
    if (unique.length === 1) return { kind: 'one', providerKey: provider.key, noun: provider.noun, query: parsed, match: unique[0] }

    return { kind: 'many', providerKey: provider.key, noun: provider.noun, query: parsed, matches: unique }
  }

  return null
}

/** Suggestions from every provider that applies here, in provider order, without repeats. */
export async function collectSuggestions<App>(
  providers: Array<EntityProvider<App>>,
  context: EntityContext<App>,
  limit = 6,
): Promise<string[]> {
  const out: string[] = []

  for (const provider of providers) {
    if (!provider.appliesTo(context) || !provider.suggestions) continue

    try {
      for (const suggestion of await provider.suggestions(context)) {
        if (!out.includes(suggestion) && out.length < limit) out.push(suggestion)
      }
    } catch {
      // A provider that cannot read its records offers nothing rather than a guess.
    }
  }

  return out
}
