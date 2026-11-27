import type { Opportunity } from '@/services/signals/opportunities'

/**
 * A signal delivered by an AI source (Claude, GPT, DeepSeek, Gemini) whose organisation type the AI did not state is not placed under B2B, B2C or B2G:
 * it matches no ICP-type selector, and it is found under "All ICP types". This says so on the card, so it is never a mystery why it is not under B2G.
 * Nothing is shown for a signal that has an ICP type, or that did not come from an AI source.
 */
export function AiUnclassifiedNote({ signal }: { signal: Pick<Opportunity, 'ai_source' | 'customer_model'> }) {
  if (!signal.ai_source || signal.customer_model) return null

  return (
    <span
      className="ml-2 inline-flex items-center rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300"
      title="The AI did not state what kind of organisation this is, so it is not placed under B2B, B2C or B2G. Choose All ICP types to see it."
      data-testid="ai-unclassified"
    >
      ICP type not stated · see All ICP types
    </span>
  )
}
