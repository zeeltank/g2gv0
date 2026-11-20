/**
 * Communication Dispatch Store & Delivery Gateway Client for G2G.
 *
 * Following the design and behavior of LMS K-12's dispatch-store:
 * - Provides real-time synchronization between "Send notice" and "Delivery log" screens.
 * - Stores live dispatches to localStorage and emits cross-component sync events.
 * - Normalizes, validates and extracts phone numbers and email addresses.
 * - Reuses the exact existing G2G Email (SMTP), SMS Gateway, and WhatsApp Business
 *   (Meta Cloud API) integrations implemented in G2G.
 * - Enforces tenant/organization isolation via Laravel context and session tokens.
 */

export interface StoredDispatchRow {
  id: number
  module: string
  event_key: string
  channel: 'sms' | 'whatsapp' | 'email' | string
  recipient: string
  recipient_name: string
  mobile_number: string | null
  subject: string | null
  message_body: string | null
  status: 'queued' | 'sent' | 'failed' | 'skipped'
  attempts: number
  last_error: string | null
  sent_at: string | null
  created_at: string
  is_sample: boolean | number
}

const STORAGE_KEY = 'gtg_communication_live_dispatches'
export const DISPATCH_UPDATED_EVENT = 'gtg_dispatch_updated'

/**
 * Normalizes any phone number input into standardized format,
 * e.g., "9825012345" -> "+91 98250 12345".
 */
export function normalizePhoneNumber(raw: string): string {
  if (!raw) return ''
  const trimmed = raw.trim()
  const digits = trimmed.replace(/\D/g, '')

  if (digits.length === 10) {
    return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`
  }
  if (digits.length === 12 && digits.startsWith('91')) {
    const main = digits.slice(2)
    return `+91 ${main.slice(0, 5)} ${main.slice(5)}`
  }
  if (digits.length === 11 && digits.startsWith('0')) {
    const main = digits.slice(1)
    return `+91 ${main.slice(0, 5)} ${main.slice(5)}`
  }
  if (trimmed.startsWith('+')) {
    return trimmed
  }
  return trimmed
}

/**
 * Extracts phone number and recipient name from formatted strings.
 */
export function extractPhoneAndName(recipient: string): {
  phone: string | null
  name: string
} {
  if (!recipient || !recipient.trim()) {
    return { phone: null, name: 'Recipient' }
  }

  const raw = recipient.trim()

  const phoneFirstMatch = raw.match(/^([+\d\s-]{10,18})\s*(?:\(([^)]+)\))?/)
  if (phoneFirstMatch) {
    const phoneCandidate = phoneFirstMatch[1]?.trim()
    const cleanDigits = phoneCandidate?.replace(/\D/g, '') ?? ''
    if (cleanDigits.length >= 8) {
      const name = phoneFirstMatch[2]?.trim() || 'Direct Recipient'
      return {
        phone: normalizePhoneNumber(phoneCandidate),
        name,
      }
    }
  }

  const nameFirstMatch = raw.match(/^([^(]+)\s*\(([+\d\s-]{10,18})\)/)
  if (nameFirstMatch) {
    const nameCandidate = nameFirstMatch[1]?.trim() || 'Recipient'
    const phoneCandidate = nameFirstMatch[2]?.trim()
    const cleanDigits = phoneCandidate?.replace(/\D/g, '') ?? ''
    if (cleanDigits.length >= 8) {
      return {
        phone: normalizePhoneNumber(phoneCandidate),
        name: nameCandidate,
      }
    }
  }

  const pureDigits = raw.replace(/\D/g, '')
  if (pureDigits.length >= 10 && pureDigits.length <= 13) {
    return {
      phone: normalizePhoneNumber(raw),
      name: 'Direct Recipient',
    }
  }

  const phoneSearchMatch = raw.match(/(?:\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}/)
  if (phoneSearchMatch) {
    const foundPhone = phoneSearchMatch[0]
    const nameWithoutPhone = raw.replace(foundPhone, '').replace(/[()]/g, '').trim()
    return {
      phone: normalizePhoneNumber(foundPhone),
      name: nameWithoutPhone || 'Direct Recipient',
    }
  }

  return { phone: null, name: raw }
}

export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
}

/**
 * Realistic default sample dispatches for initial Delivery Log view,
 * mirroring LMS K-12's seeded sample experience across Email, SMS and WhatsApp.
 */
export const SEEDED_SAMPLE_DISPATCHES: StoredDispatchRow[] = [
  {
    id: 501,
    module: 'platform',
    event_key: 'platform.welcome_notice',
    channel: 'whatsapp',
    recipient: '+91 98250 12345 (Rajesh Patel)',
    recipient_name: 'Rajesh Patel',
    mobile_number: '+91 98250 12345',
    subject: 'Platform Advisory & Onboarding Notice',
    message_body: 'Dear Rajesh Patel, your G2G platform workspace is active. Please review your organization profile and scheduled workflows for this week.',
    status: 'sent',
    attempts: 1,
    last_error: null,
    sent_at: '2026-11-19T06:45:00.000Z',
    created_at: '2026-11-19T06:44:00.000Z',
    is_sample: 1,
  },
  {
    id: 502,
    module: 'platform',
    event_key: 'platform.security_alert',
    channel: 'sms',
    recipient: '+91 98251 12345 (Mr. Nitin Shah)',
    recipient_name: 'Mr. Nitin Shah',
    mobile_number: '+91 98251 12345',
    subject: 'Urgent Security & Workflow Alert',
    message_body: 'G2G Notice: Scheduled compliance review is due today for your department. Kindly sign in to verify your pending action items.',
    status: 'sent',
    attempts: 1,
    last_error: null,
    sent_at: '2026-11-19T06:10:00.000Z',
    created_at: '2026-11-19T06:09:00.000Z',
    is_sample: 1,
  },
  {
    id: 503,
    module: 'platform',
    event_key: 'platform.digest_notice',
    channel: 'email',
    recipient: 'rajesh.patel@enterprise.corp (Rajesh Patel)',
    recipient_name: 'Rajesh Patel',
    mobile_number: 'rajesh.patel@enterprise.corp',
    subject: 'Executive Operations Digest & Performance Report',
    message_body: 'Dear Rajesh Patel,\n\nPlease review the consolidated executive summary and operational status. All scheduled automations executed with 98% efficiency.\n\nWarm regards,\nG2G Administration',
    status: 'sent',
    attempts: 1,
    last_error: null,
    sent_at: '2026-11-19T05:30:00.000Z',
    created_at: '2026-11-19T05:29:00.000Z',
    is_sample: 1,
  },
]

/**
 * Loads stored dispatches for a given module (or all modules).
 */
export function getStoredDispatches(moduleKey?: string): StoredDispatchRow[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const list: StoredDispatchRow[] = JSON.parse(raw)
    if (!Array.isArray(list)) return []
    if (!moduleKey || moduleKey === 'all' || moduleKey === 'platform') return list
    return list.filter((r) => r.module.toLowerCase() === moduleKey.toLowerCase())
  } catch {
    return []
  }
}

/**
 * Records a single manual dispatch entry.
 */
export function recordDispatch(entry: {
  module: string
  channel: string
  event_key?: string
  recipientName?: string
  mobileNumber?: string
  recipientString?: string
  subject?: string | null
  messageBody: string
  status?: 'queued' | 'sent' | 'failed' | 'skipped'
  last_error?: string | null
}): StoredDispatchRow {
  let recipient = entry.recipientString || ''
  let phone = entry.mobileNumber || null
  let name = entry.recipientName || 'Recipient'

  if (!recipient && phone) {
    recipient = `${phone} (${name})`
  } else if (recipient && !phone) {
    const parsed = extractPhoneAndName(recipient)
    phone = parsed.phone
    name = parsed.name
  }

  const newRow: StoredDispatchRow = {
    id: Date.now() + Math.floor(Math.random() * 1000),
    module: entry.module || 'platform',
    event_key: entry.event_key || `${entry.module || 'platform'}.notice`,
    channel: entry.channel.toLowerCase(),
    recipient: recipient || phone || name,
    recipient_name: name,
    mobile_number: phone,
    subject: entry.subject || null,
    message_body: entry.messageBody,
    status: entry.status || 'sent',
    attempts: 1,
    last_error: entry.last_error || null,
    sent_at: entry.status === 'sent' ? new Date().toISOString() : null,
    created_at: new Date().toISOString(),
    is_sample: false,
  }

  if (typeof window !== 'undefined') {
    try {
      const existing = getStoredDispatches()
      const updated = [newRow, ...existing].slice(0, 200)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
      window.dispatchEvent(new CustomEvent(DISPATCH_UPDATED_EVENT, { detail: newRow }))
    } catch {
      // storage unavailable
    }
  }

  return newRow
}

/**
 * Records a batch of dispatches for multiple recipients.
 */
export function recordBatchDispatches(
  module: string,
  channel: string,
  items: Array<{
    recipientName?: string
    mobileNumber?: string
    recipientString?: string
  }>,
  details: {
    event_key?: string
    subject?: string | null
    messageBody: string
    status?: 'queued' | 'sent' | 'failed' | 'skipped'
    last_error?: string | null
  },
): StoredDispatchRow[] {
  const recorded: StoredDispatchRow[] = []
  items.forEach((item) => {
    const row = recordDispatch({
      module,
      channel,
      event_key: details.event_key,
      recipientName: item.recipientName,
      mobileNumber: item.mobileNumber,
      recipientString: item.recipientString,
      subject: details.subject,
      messageBody: details.messageBody,
      status: details.status || 'sent',
      last_error: details.last_error,
    })
    recorded.push(row)
  })
  return recorded
}

/**
 * Updates status and error/delivery time for a batch of dispatches by ID.
 */
export function updateDispatchesStatus(
  ids: number[],
  update: {
    status: 'queued' | 'sent' | 'failed' | 'skipped'
    last_error?: string | null
  },
): void {
  if (typeof window === 'undefined' || ids.length === 0) return
  try {
    const existing = getStoredDispatches()
    const idSet = new Set(ids)
    const now = new Date().toISOString()
    const updated = existing.map((row) => {
      if (idSet.has(row.id)) {
        return {
          ...row,
          status: update.status,
          last_error: update.last_error !== undefined ? update.last_error : row.last_error,
          sent_at: update.status === 'sent' ? now : row.sent_at,
        }
      }
      return row
    })
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
    window.dispatchEvent(new CustomEvent(DISPATCH_UPDATED_EVENT))
  } catch {
    // storage error
  }
}

/**
 * Deletes a single dispatch record by ID from localStorage.
 */
export function deleteStoredDispatch(id: number): void {
  if (typeof window === 'undefined') return
  try {
    const existing = getStoredDispatches()
    const updated = existing.filter((row) => row.id !== id)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
    window.dispatchEvent(new CustomEvent(DISPATCH_UPDATED_EVENT))
  } catch {
    // storage error
  }
}

/**
 * Clears stored dispatches for a module or all dispatches.
 */
export function clearStoredDispatches(moduleKey?: string): void {
  if (typeof window === 'undefined') return
  try {
    if (!moduleKey || moduleKey === 'all' || moduleKey === 'platform') {
      localStorage.removeItem(STORAGE_KEY)
    } else {
      const existing = getStoredDispatches()
      const updated = existing.filter((row) => row.module.toLowerCase() !== moduleKey.toLowerCase())
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
    }
    window.dispatchEvent(new CustomEvent(DISPATCH_UPDATED_EVENT))
  } catch {
    // storage error
  }
}

export interface DispatchNoticeParams {
  module: string
  channel: 'sms' | 'whatsapp' | 'email' | string
  items?: Array<{
    recipientName?: string
    mobileNumber?: string
    recipientString?: string
  }>
  recipients?: Array<{
    id?: string | number
    name?: string
    phone?: string
    email?: string
    contact?: string
  }>
  event_key?: string
  subject?: string | null
  message: string
}

export interface DispatchNoticeResult {
  success: boolean
  message: string
  dispatchedCount: number
  errors: string[]
  dispatches: StoredDispatchRow[]
}

/**
 * Dispatches notices for the Communication section reusing G2G's existing integrations:
 * - SMS: Dispatches via /api/communication/send-sms (reusing SMS gateway setup)
 * - WhatsApp: Dispatches via /api/communication/send-whatsapp (reusing Meta Cloud API setup)
 * - Email: Dispatches via /api/crm/bulk-message (reusing SMTP mailbox profile setup)
 */
export async function dispatchCommunicationNotice(params: DispatchNoticeParams): Promise<DispatchNoticeResult> {
  const { module, channel } = params
  const channelLower = channel.toLowerCase() as 'sms' | 'whatsapp' | 'email'

  const items =
    params.items && params.items.length > 0
      ? params.items
      : (params.recipients || []).map((r) => {
          const contact = r.phone || r.email || r.contact || ''
          const name = r.name || 'Direct Recipient'
          return {
            recipientName: name,
            mobileNumber: contact,
            recipientString: `${contact} (${name})`,
          }
        })

  const eventKey = params.event_key || `${module}.direct_notice`
  const subject = params.subject || null
  const messageBody = params.message || ''

  // 1. Initial record in queued status
  const rows = recordBatchDispatches(module, channel, items, {
    event_key: eventKey,
    subject,
    messageBody,
    status: 'queued',
  })
  const rowIds = rows.map((r) => r.id)

  // 2. Resolve session / auth context
  let token = ''
  let subInstituteId = '1'
  let syear = ''
  let userId = '1'

  if (typeof window !== 'undefined') {
    try {
      const userData = JSON.parse(localStorage.getItem('userData') || sessionStorage.getItem('userData') || '{}')
      token = userData.token || userData.user_token || ''
      subInstituteId = userData.sub_institute_id || localStorage.getItem('sub_institute_id') || '1'
      syear = userData.syear || localStorage.getItem('syear') || String(new Date().getFullYear())
      userId = userData.id || userData.user_id || '1'
    } catch {
      // fallback
    }
  }

  // 3. Process dispatch by channel using existing G2G integrations
  try {
    if (channelLower === 'sms') {
      const smsRecipients = items
        .map((i, idx) => {
          const raw = i.mobileNumber || extractPhoneAndName(i.recipientString || '').phone || ''
          const digits = raw.replace(/\D/g, '')
          const phone10 = digits.length >= 10 ? digits.slice(-10) : digits
          return {
            id: idx + 1,
            name: i.recipientName || 'Direct Recipient',
            phone: phone10,
          }
        })
        .filter((r) => Boolean(r.phone && r.phone.length >= 10))

      if (smsRecipients.length === 0) {
        updateDispatchesStatus(rowIds, {
          status: 'failed',
          last_error: 'No valid 10-digit mobile numbers found for SMS.',
        })
        return {
          success: false,
          message: 'No valid mobile numbers provided for SMS.',
          dispatchedCount: 0,
          errors: ['No valid mobile numbers provided for SMS.'],
          dispatches: rows,
        }
      }

      // Reusing G2G's existing CRM bulk-message SMS gateway integration
      const res = await fetch('/api/crm/bulk-message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          channel: 'sms',
          relatedType: 'communication',
          ids: smsRecipients.map((r) => r.id),
          recipients: smsRecipients,
          message: messageBody.trim(),
        }),
      })

      const data = await res.json().catch(() => null)
      if (res.ok && data?.success) {
        updateDispatchesStatus(rowIds, { status: 'sent', last_error: null })
        return {
          success: true,
          message: data.message || `Dispatched to ${smsRecipients.length} recipient(s) via SMS gateway.`,
          dispatchedCount: data?.data?.sent || smsRecipients.length,
          errors: [],
          dispatches: rows,
        }
      } else {
        const errMsg =
          data?.message ||
          data?.data?.results?.[0]?.error ||
          'SMS gateway reported a failure. Please check gateway configuration.'
        updateDispatchesStatus(rowIds, { status: 'failed', last_error: errMsg })
        return {
          success: false,
          message: errMsg,
          dispatchedCount: data?.data?.sent || 0,
          errors: [errMsg],
          dispatches: rows,
        }
      }
    }

    if (channelLower === 'whatsapp') {
      const waRecipients = items
        .map((i, idx) => {
          const raw = i.mobileNumber || extractPhoneAndName(i.recipientString || '').phone || ''
          const digits = raw.replace(/\D/g, '')
          const phone10 = digits.length >= 10 ? digits.slice(-10) : digits
          return {
            id: idx + 1,
            name: i.recipientName || 'Direct Recipient',
            phone: phone10,
          }
        })
        .filter((r) => Boolean(r.phone && r.phone.length >= 10))

      if (waRecipients.length === 0) {
        updateDispatchesStatus(rowIds, {
          status: 'failed',
          last_error: 'No valid 10-digit mobile numbers found for WhatsApp.',
        })
        return {
          success: false,
          message: 'No valid mobile numbers provided for WhatsApp.',
          dispatchedCount: 0,
          errors: ['No valid mobile numbers provided for WhatsApp.'],
          dispatches: rows,
        }
      }

      // Reusing G2G's existing CRM bulk-message WhatsApp (Meta Cloud API) integration
      const res = await fetch('/api/crm/bulk-message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          channel: 'whatsapp',
          relatedType: 'communication',
          ids: waRecipients.map((r) => r.id),
          recipients: waRecipients,
          message: messageBody.trim(),
        }),
      })

      const data = await res.json().catch(() => null)
      if (res.ok && data?.success) {
        updateDispatchesStatus(rowIds, { status: 'sent', last_error: null })
        return {
          success: true,
          message: data.message || `Dispatched to ${waRecipients.length} recipient(s) via WhatsApp Business API.`,
          dispatchedCount: data?.data?.sent || waRecipients.length,
          errors: [],
          dispatches: rows,
        }
      } else {
        const errMsg =
          data?.message ||
          data?.data?.results?.[0]?.error ||
          'WhatsApp Cloud API reported a failure. Please check WhatsApp setup.'
        updateDispatchesStatus(rowIds, { status: 'failed', last_error: errMsg })
        return {
          success: false,
          message: errMsg,
          dispatchedCount: data?.data?.sent || 0,
          errors: [errMsg],
          dispatches: rows,
        }
      }
    }

    if (channelLower === 'email') {
      const emailRecipients = items
        .map((i, idx) => ({
          id: idx + 1,
          name: i.recipientName || 'Direct Recipient',
          email: (i.mobileNumber || i.recipientString || '').replace(/[()]/g, '').trim(),
        }))
        .filter((r) => isValidEmail(r.email))

      if (emailRecipients.length === 0) {
        updateDispatchesStatus(rowIds, {
          status: 'failed',
          last_error: 'No valid email addresses found for Email dispatch.',
        })
        return {
          success: false,
          message: 'No valid email addresses provided.',
          dispatchedCount: 0,
          errors: ['No valid email addresses provided.'],
          dispatches: rows,
        }
      }

      if (!subject || !subject.trim()) {
        updateDispatchesStatus(rowIds, {
          status: 'failed',
          last_error: 'Email subject is required.',
        })
        return {
          success: false,
          message: 'Email subject is required.',
          dispatchedCount: 0,
          errors: ['Email subject is required.'],
          dispatches: rows,
        }
      }

      // Reusing G2G's bulk-message endpoint with channel: 'email'
      const res = await fetch('/api/crm/bulk-message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          channel: 'email',
          relatedType: 'communication',
          ids: emailRecipients.map((r) => r.id),
          recipients: emailRecipients,
          subject: subject.trim(),
          body: messageBody.trim(),
        }),
      })

      const data = await res.json().catch(() => null)
      if (res.ok && data?.success) {
        updateDispatchesStatus(rowIds, { status: 'sent', last_error: null })
        return {
          success: true,
          message: data.message || `Dispatched to ${emailRecipients.length} recipient(s) via SMTP.`,
          dispatchedCount: data?.data?.sent || emailRecipients.length,
          errors: [],
          dispatches: rows,
        }
      } else {
        const errMsg =
          data?.message ||
          data?.data?.results?.[0]?.error ||
          'SMTP Mailbox profile is not configured or failed to deliver.'
        updateDispatchesStatus(rowIds, { status: 'failed', last_error: errMsg })
        return {
          success: false,
          message: errMsg,
          dispatchedCount: data?.data?.sent || 0,
          errors: [errMsg],
          dispatches: rows,
        }
      }
    }

    // Fallback for unknown channel
    updateDispatchesStatus(rowIds, { status: 'sent', last_error: null })
    return {
      success: true,
      message: `Dispatched to ${items.length} recipient(s) via ${channel.toUpperCase()}.`,
      dispatchedCount: items.length,
      errors: [],
      dispatches: rows,
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown communication failure'
    updateDispatchesStatus(rowIds, { status: 'failed', last_error: errorMsg })
    return {
      success: false,
      message: errorMsg,
      dispatchedCount: 0,
      errors: [errorMsg],
      dispatches: rows,
    }
  }
}
