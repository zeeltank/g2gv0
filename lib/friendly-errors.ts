/**
 * User-friendly mapping layer for ICP and Product form errors and validation problems.
 *
 * Translates raw backend schema paths (e.g. `industry_label`, `must_have[0].value`)
 * and technical validation messages (e.g. `give exactly one of "attribute" or "field"`)
 * into clear, actionable, human-readable labels and guidance.
 */

const FIELD_LABELS: Record<string, string> = {
  // ICP Fields
  label: 'ICP Name',
  name: 'ICP Name',
  icp_label: 'ICP Name',
  industry_label: 'Industry / Organisation Profile',
  icp_industry_label: 'Industry / Organisation Profile',
  customer_model: 'Customer Type',
  pitch: 'Customer Pains and Desired Outcomes',
  guidance: 'ICP Qualification Guidance',
  icp_guidance: 'ICP Qualification Guidance',
  buyer_types: 'Ideal Buyer Types',
  icp_buyer_types: 'Ideal Buyer Types',
  regions: 'Target Geographies / Regions',
  priority_cities: 'Priority Cities',
  competitors: 'Competitors',
  vendor_phrases: 'Vendor Phrases',
  parts: 'Product Parts / Modules',
  triggers: 'Buying Triggers and Intent Signals',
  queries: 'Search Queries and Discovery Guidance',
  disqualifiers: 'Exclusion Criteria',
  must_have: 'Required Customer Qualification Criteria',
  watch_rules: 'Watch Rules',
  evidence_rules: 'Evidence Rules',
  criteria: 'Scoring Criteria',
  evidence_points: 'Evidence Points',
  priority: 'Priority Bands',
  per_run: 'Search Runs Allocation',
  offer_ids: 'Portfolio Products',
  account_query: 'Account Search Query',

  // Product Portfolio Fields
  offer_id: 'Product ID',
  parent_product: 'Category',
  readiness_status: 'Readiness Status',
  what_it_does: 'Product Description',
  modules_components: 'Features and Capabilities',
  problems: 'Customer Problems Solved',
  needs_solved: 'Customer Problems Solved',
  primary_segments: 'Target Customers',
  trigger_signals: 'Buying Events',
  proof_points: 'Benefits and Proof',
  pricing_model: 'Pricing Model',
  typical_deal_band: 'Typical Deal Size',
  deployment_model: 'Deployment Model',
  implementation_effort: 'Implementation Effort',
  delivery_owner: 'Delivery Owner',
  notes: 'Notes',
}

/**
 * Humanizes a technical field or path, including array indices and nested keys.
 * E.g. `must_have[0].value` -> `Required Customer Qualification Criteria #1 Value`
 */
export function humanizeField(path: string): string {
  if (!path) return 'General'
  const trimmed = path.trim()

  if (FIELD_LABELS[trimmed]) {
    return FIELD_LABELS[trimmed]
  }

  // Handle must_have[i] and must_have[i].prop
  const mustHaveMatch = trimmed.match(/^must_have\[(\d+)\](?:\.([a-z0-9_]+))?$/i)
  if (mustHaveMatch) {
    const idx = Number(mustHaveMatch[1]) + 1
    const prop = mustHaveMatch[2]
    if (!prop) return `Required Customer Qualification Criteria #${idx}`
    if (prop === 'value') return `Required Customer Qualification Criteria #${idx} Value`
    if (prop === 'label') return `Required Customer Qualification Criteria #${idx} Label`
    if (prop === 'subject' || prop === 'attribute' || prop === 'field') return `Required Customer Qualification Criteria #${idx} Fact / Field`
    if (prop === 'op') return `Required Customer Qualification Criteria #${idx} Rule`
    if (prop === 'prompt') return `Required Customer Qualification Criteria #${idx} Prompt`
    return `Required Customer Qualification Criteria #${idx} (${prop})`
  }

  // Handle disqualifiers[i]
  const disqualifierMatch = trimmed.match(/^disqualifiers\[(\d+)\](?:\.([a-z0-9_]+))?$/i)
  if (disqualifierMatch) {
    const idx = Number(disqualifierMatch[1]) + 1
    const prop = disqualifierMatch[2]
    if (!prop) return `Exclusion Criteria #${idx}`
    if (prop === 'label') return `Exclusion Criteria #${idx} Label`
    if (prop === 'phrases') return `Exclusion Criteria #${idx} Phrases`
    return `Exclusion Criteria #${idx} (${prop})`
  }

  // Handle queries[i]
  const queryMatch = trimmed.match(/^queries\[(\d+)\](?:\.([a-z0-9_]+))?$/i)
  if (queryMatch) {
    const idx = Number(queryMatch[1]) + 1
    const prop = queryMatch[2]
    if (!prop) return `Search Query #${idx}`
    if (prop === 'q') return `Search Query #${idx} Search Words`
    if (prop === 'domains') return `Search Query #${idx} Sites`
    return `Search Query #${idx} (${prop})`
  }

  // Handle triggers.key or triggers[i]
  const triggerMatch = trimmed.match(/^triggers(?:\.([a-z0-9_]+)|\[(\d+)\])(?:\.([a-z0-9_]+))?$/i)
  if (triggerMatch) {
    const key = triggerMatch[1] || (triggerMatch[2] != null ? `#${Number(triggerMatch[2]) + 1}` : '')
    const prop = triggerMatch[3]
    return prop ? `Buying Trigger ${key} (${prop})` : `Buying Trigger ${key}`
  }

  // Handle per_run.sub
  if (trimmed.startsWith('per_run.')) {
    const sub = trimmed.slice(8)
    return `Search Allocation (${sub})`
  }

  // Fallback: title-case words and convert [i] to #i+1
  return trimmed
    .replace(/\[(\d+)\]/g, (_, i) => ` #${Number(i) + 1}`)
    .replace(/[._]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

/**
 * Translates technical error messages into clear, human-readable guidance.
 */
export function humanizeMessage(path: string, rawMessage: string): string {
  const msg = rawMessage.trim()

  // Character length & multi-line errors
  if (msg.includes('characters on one line') || (msg.includes('text of') && msg.includes('characters'))) {
    const rangeMatch = msg.match(/(\d+)\s+to\s+(\d+)/)
    const min = rangeMatch ? rangeMatch[1] : '1'
    const max = rangeMatch ? rangeMatch[2] : '5000'
    if (path.includes('industry_label')) {
      return `Please enter between ${min} and ${Number(max) >= 10000 ? '10,000' : max} characters.`
    }
    if (path.includes('guidance')) {
      return `Please enter up to ${Number(max) >= 5000 ? '5,000' : max} characters.`
    }
    return `Please enter between ${min} and ${max} characters.`
  }

  // Buyer types length
  if (msg.includes('each item up to') && (path.includes('buyer_types') || path.includes('regions'))) {
    return 'Each item must be 200 characters or less.'
  }

  // Criteria subject (attribute/field)
  if (msg.includes('give exactly one of "attribute" or "field"') || msg.includes('needs a key')) {
    return 'Please enter a valid criteria name or fact (letters, digits, and underscores).'
  }

  // Criteria values
  if (msg === 'a number' || msg.includes('must be a number')) {
    return 'Please enter a valid number.'
  }
  if (msg === 'required' || msg.includes('is required')) {
    if (path.includes('.label') || path.endsWith('label')) {
      return 'Please enter a label or description.'
    }
    if (path.includes('.value') || path.endsWith('value')) {
      return 'Please enter a value for this criterion.'
    }
    if (path.includes('.subject') || path.includes('attribute') || path.includes('field')) {
      return 'Criteria name or fact is required.'
    }
    return 'This field is required.'
  }
  if (msg.includes('between needs [low, high]')) {
    return 'Between rule requires two numbers: [low, high].'
  }
  if (msg.includes('a non-empty list')) {
    return 'Please enter at least one item (comma-separated).'
  }
  if (msg.includes('in_regions needs the ICP to list its regions')) {
    return 'To check target regions, first add target regions in the Geography section.'
  }
  if (msg.includes('one of b2b, b2c or both')) {
    return 'Please select B2B, B2C, or Both.'
  }
  if (msg.includes('unknown setting')) {
    return 'Unrecognized setting will be ignored.'
  }
  if (msg.includes('too large')) {
    return 'The ICP profile is too large. Please shorten long descriptive sections.'
  }
  if (msg.includes('give at least one phrase')) {
    return 'Please provide at least one phrase or word.'
  }

  return msg
}

/**
 * Formats a single raw problem string (e.g. `industry_label: text of 1 to 5000 characters on one line`)
 * into a user-friendly string (e.g. `Industry / Organisation Profile: Please enter between 1 and 10,000 characters.`).
 */
export function formatFriendlyProblem(rawProblem: string): string {
  if (!rawProblem || typeof rawProblem !== 'string') return ''
  const colonIdx = rawProblem.indexOf(':')
  if (colonIdx === -1) {
    return humanizeMessage('', rawProblem)
  }

  const rawPath = rawProblem.slice(0, colonIdx).trim()
  const rawMsg = rawProblem.slice(colonIdx + 1).trim()

  const friendlyPath = humanizeField(rawPath)
  const friendlyMsg = humanizeMessage(rawPath, rawMsg)

  return `${friendlyPath}: ${friendlyMsg}`
}

/**
 * Formats an array of raw problems, translates them, and deduplicates the results.
 */
export function formatFriendlyProblems(problems: unknown): string[] {
  if (!Array.isArray(problems)) return []
  const out: string[] = []
  const seen = new Set<string>()

  for (const p of problems) {
    if (typeof p !== 'string' || !p.trim()) continue
    const formatted = formatFriendlyProblem(p)
    if (formatted && !seen.has(formatted)) {
      seen.add(formatted)
      out.push(formatted)
    }
  }

  return out
}

/**
 * Extracts field-level errors keyed by form input names.
 * Supports backend arrays of problems (`["path: msg"]`) as well as `{ field: ["msg"] }` objects.
 */
export function friendlyFieldErrors(
  source: unknown,
): Record<string, string> {
  const result: Record<string, string> = {}
  if (!source) return result

  if (Array.isArray(source)) {
    for (const item of source) {
      if (typeof item !== 'string') continue
      const colonIdx = item.indexOf(':')
      if (colonIdx === -1) continue
      const rawPath = item.slice(0, colonIdx).trim()
      const rawMsg = item.slice(colonIdx + 1).trim()
      const friendlyMsg = humanizeMessage(rawPath, rawMsg)

      // Map technical path to closest form input name
      const key = rawPath.split('[')[0].split('.')[0]
      if (!result[key]) {
        result[key] = friendlyMsg
      }
    }
    return result
  }

  if (typeof source === 'object') {
    for (const [key, value] of Object.entries(source as Record<string, unknown>)) {
      const msg = Array.isArray(value) ? value[0] : String(value)
      if (msg) {
        result[key] = humanizeMessage(key, msg)
      }
    }
  }

  return result
}

/**
 * Provides a clean, consolidated summary string for form-level error banners.
 */
export function friendlyErrorSummary(source: unknown, fallback = 'Please check the highlighted fields.'): string {
  const friendly = formatFriendlyProblems(source)
  if (friendly.length === 0) {
    if (typeof source === 'object' && source !== null && !Array.isArray(source)) {
      const mapped = friendlyFieldErrors(source)
      const values = Object.values(mapped)
      if (values.length > 0) return values.slice(0, 3).join(' · ')
    }
    return fallback
  }

  if (friendly.length === 1) return friendly[0]
  if (friendly.length <= 3) return friendly.join(' · ')
  return `${friendly.slice(0, 2).join(' · ')} (+${friendly.length - 2} more)`
}

