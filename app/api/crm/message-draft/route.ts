import { NextRequest, NextResponse } from 'next/server'
import { resolveAiBaseUrl, resolveApiBaseUrl } from '@/lib/api-config'
import {
  CHANNEL_LIMITS,
  MESSAGE_PURPOSES,
  toWhatsappTemplateText,
  type MessageChannel,
  type MessageDraft,
} from '@/lib/crm/message-channels'

export const runtime = 'nodejs'
export const maxDuration = 60

/** The prompt is owned by Template Management (`ai_templates`), not by this file. */
const CRM_MESSAGE_TEMPLATE_KEY = 'g2g.crm_message'
/** Recipients drafted at once: bounded so one click cannot fan out into an unbounded number of model calls. */
const MAX_RECIPIENTS = 50
const PARALLEL_CALLS = 4

type RelatedType = 'lead' | 'contact' | 'organization'

interface DraftPayload {
  channel: MessageChannel
  relatedType: RelatedType
  ids: (string | number)[]
  purpose: string
  instruction?: string
  /** Per-recipient text already in the composer, so "regenerate" can improve rather than restart. */
  existingDrafts?: Record<string, string>
}

// Where each record type is read from. The CRM API enforces the caller's tenant and menu permission,
// so another organisation's record is simply "not found" and nothing here needs to know the tenant.
const ENDPOINTS: Record<RelatedType, string> = {
  lead: 'leads',
  contact: 'contacts',
  organization: 'organizations',
}

// What describes the person or business, in the API's own field names. Only non-empty values reach the prompt.
const FIELDS: Record<RelatedType, Array<[string, string]>> = {
  lead: [
    ['salutation', 'Salutation'],
    ['firstName', 'First name'],
    ['lastName', 'Last name'],
    ['company', 'Company'],
    ['designation', 'Designation'],
    ['industry', 'Industry'],
    ['product', 'Product of interest'],
    ['leadSource', 'Lead source'],
    ['leadStatus', 'Lead status'],
    ['lifecycleStatus', 'Lifecycle stage'],
    ['nextAction', 'Planned next action'],
    ['followUpDueDate', 'Follow-up due date'],
    ['rating', 'Rating'],
    ['city', 'City'],
    ['state', 'State'],
    ['country', 'Country'],
    ['campaignText', 'Campaign'],
    ['description', 'Notes on the lead'],
  ],
  contact: [
    ['salutation', 'Salutation'],
    ['firstName', 'First name'],
    ['lastName', 'Last name'],
    ['organizationName', 'Organization'],
    ['title', 'Title'],
    ['department', 'Department'],
    ['leadSource', 'Source'],
    ['mailingCity', 'City'],
    ['mailingState', 'State'],
    ['mailingCountry', 'Country'],
    ['description', 'Notes on the contact'],
  ],
  organization: [
    ['name', 'Organization'],
    ['accountType', 'Account type'],
    ['industry', 'Industry'],
    ['website', 'Website'],
    ['billingCity', 'City'],
    ['billingState', 'State'],
    ['billingCountry', 'Country'],
    ['description', 'Notes on the organization'],
  ],
}

type ApiRecord = Record<string, unknown>

function describeRecord(type: RelatedType, row: ApiRecord): string {
  return FIELDS[type]
    .map(([key, label]) => {
      const value = row[key]
      if (value === null || value === undefined || typeof value === 'object') return null
      const text = String(value).trim()
      return text ? `- ${label}: ${text.slice(0, 500)}` : null
    })
    .filter(Boolean)
    .join('\n')
}

function recipientName(type: RelatedType, row: ApiRecord, id: number): string {
  if (type === 'organization') return String(row.name || '').trim() || `Record #${id}`
  const person = `${row.firstName || ''} ${row.lastName || ''}`.trim()
  return person || String(row.company || row.organizationName || '').trim() || `Record #${id}`
}

/** Email answers arrive as "Subject: …" then a blank line then the body. */
function splitEmail(text: string): { subject: string; body: string } {
  const match = text.match(/^\s*subject\s*:\s*(.+?)\r?\n+([\s\S]*)$/i)
  return match ? { subject: match[1].trim(), body: match[2].trim() } : { subject: '', body: text.trim() }
}

function cleanModelText(text: string): string {
  return text
    .replace(/^```[a-z]*\n?/i, '')
    .replace(/\n?```$/, '')
    .trim()
}

const jsonHeaders = (authorization: string) => ({ Accept: 'application/json', Authorization: authorization })

async function fetchRecord(apiBase: string, authorization: string, type: RelatedType, id: number): Promise<ApiRecord | null> {
  const response = await fetch(`${apiBase}/crm/${ENDPOINTS[type]}/${id}`, {
    cache: 'no-store',
    headers: jsonHeaders(authorization),
  }).catch(() => null)
  if (!response?.ok) return null
  const body = await response.json().catch(() => null)
  return body?.data && typeof body.data === 'object' ? (body.data as ApiRecord) : null
}

/** The signed-in person's name, so the draft can be signed. Best effort: a draft is still useful without it. */
async function fetchSenderName(apiBase: string, authorization: string): Promise<string> {
  const response = await fetch(`${apiBase}/account/me`, { cache: 'no-store', headers: jsonHeaders(authorization) }).catch(
    () => null,
  )
  const body = response?.ok ? await response.json().catch(() => null) : null
  const profile = body?.data?.profile
  return `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim()
}

async function generate(aiBase: string, authorization: string, variables: Record<string, string>): Promise<string> {
  const response = await fetch(`${aiBase}/ai/generate`, {
    method: 'POST',
    cache: 'no-store',
    headers: { ...jsonHeaders(authorization), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      template_key: CRM_MESSAGE_TEMPLATE_KEY,
      // `<purpose>:<module>` lets the platform use the CRM module's own model choice and report usage per module.
      purpose: 'crm_message:crm',
      domain: 'g2g',
      variables,
    }),
  })
  const payload = await response.json().catch(() => null)
  if (!response.ok || payload?.success === false) {
    throw new Error(payload?.message || `The AI runtime returned ${response.status}.`)
  }
  const text = typeof payload?.data?.content === 'string' ? payload.data.content : ''
  if (!text.trim()) throw new Error('The AI runtime returned no content.')
  return cleanModelText(text)
}

export async function POST(request: NextRequest) {
  // The caller's own token goes on to the CRM and AI APIs, which resolve and enforce the tenant.
  const authorization = request.headers.get('authorization')
  if (!authorization) {
    return NextResponse.json({ success: false, message: 'Sign in to use the AI assistant.' }, { status: 401 })
  }

  let payload: DraftPayload
  try {
    payload = (await request.json()) as DraftPayload
  } catch {
    return NextResponse.json({ success: false, message: 'The request was not valid.' }, { status: 422 })
  }

  const { channel, relatedType = 'lead' } = payload
  if (!(channel in CHANNEL_LIMITS) || !(relatedType in ENDPOINTS)) {
    return NextResponse.json({ success: false, message: 'Unknown channel or record type.' }, { status: 422 })
  }
  if (!MESSAGE_PURPOSES.some((p) => p.value === payload.purpose)) {
    return NextResponse.json({ success: false, message: 'Choose what the message is for.' }, { status: 422 })
  }

  const ids = Array.from(new Set((payload.ids || []).map(Number).filter((id) => Number.isInteger(id) && id > 0)))
  if (ids.length === 0) {
    return NextResponse.json({ success: false, message: 'No records were selected.' }, { status: 400 })
  }
  if (ids.length > MAX_RECIPIENTS) {
    return NextResponse.json(
      { success: false, message: `Draft up to ${MAX_RECIPIENTS} recipients at a time.` },
      { status: 422 },
    )
  }

  const apiBase = resolveApiBaseUrl()
  const aiBase = resolveAiBaseUrl()
  if (!apiBase || !aiBase) {
    return NextResponse.json({ success: false, message: 'The API base URL is not configured.' }, { status: 500 })
  }

  const senderName = await fetchSenderName(apiBase, authorization)
  const limit = CHANNEL_LIMITS[channel].body
  const instruction = (payload.instruction || '').trim().slice(0, 1000)
  const purposeLabel = MESSAGE_PURPOSES.find((p) => p.value === payload.purpose)!.label

  const draftFor = async (id: number): Promise<MessageDraft> => {
    const row = await fetchRecord(apiBase, authorization, relatedType, id)
    if (!row) return { id: String(id), name: `Record #${id}`, body: '', error: 'Record not found.' }

    const name = recipientName(relatedType, row, id)
    try {
      const text = await generate(aiBase, authorization, {
        channel,
        purpose: purposeLabel,
        max_length: String(limit),
        recipient_context: describeRecord(relatedType, row) || `- Name: ${name}`,
        sender_context: senderName ? `- Sender name: ${senderName}` : '',
        user_instruction: instruction,
        existing_draft: (payload.existingDrafts?.[String(id)] || '').slice(0, 5000),
      })

      if (channel === 'email') {
        const { subject, body } = splitEmail(text)
        return { id: String(id), name, subject: subject.slice(0, CHANNEL_LIMITS.email.subject), body: body.slice(0, limit) }
      }
      const body = channel === 'whatsapp' ? toWhatsappTemplateText(text) : text.slice(0, limit)
      return { id: String(id), name, body }
    } catch (error) {
      return {
        id: String(id),
        name,
        body: '',
        error: error instanceof Error ? error.message : 'Could not generate a draft.',
      }
    }
  }

  // Bounded concurrency, results kept in the order the records were selected.
  const drafts: MessageDraft[] = new Array(ids.length)
  let next = 0
  await Promise.all(
    Array.from({ length: Math.min(PARALLEL_CALLS, ids.length) }, async () => {
      while (next < ids.length) {
        const index = next++
        drafts[index] = await draftFor(ids[index])
      }
    }),
  )

  const failed = drafts.filter((d) => d.error)
  if (failed.length === drafts.length) {
    // Every call failed for the same reason, almost always provider configuration: say it once.
    return NextResponse.json({ success: false, message: failed[0].error, data: { drafts } }, { status: 502 })
  }

  return NextResponse.json({ success: true, message: 'Drafts ready for review.', data: { drafts } })
}
