import { NextRequest, NextResponse } from 'next/server'
import nodemailer, { type Transporter } from 'nodemailer'
import { dbQuery } from '@/lib/mcp/server/datasource/mariadb'
import { resolveAuthenticatedTenant } from '@/lib/crm/request-auth'
import { toWhatsappTemplateText } from '@/lib/crm/message-channels'

export const runtime = 'nodejs'

interface BulkMessagePayload {
  channel: 'email' | 'sms' | 'whatsapp'
  relatedType?: 'lead' | 'contact' | 'organization' | 'communication'
  ids: (string | number)[]
  recipients?: Array<{
    id: string | number
    name?: string
    email?: string | null
    phone?: string | null
  }>
  subject?: string
  body?: string
  message?: string
  templateId?: string | number
  /** Reviewed, recipient-specific text keyed by record id. Used instead of the shared text when present. */
  messages?: Record<string, { subject?: string; body?: string }>
}

// Country calling code for the Indian mobile numbers this module normalises (see cleanIndianMobile).
const COUNTRY_CODE = '91'
// Used only when the tenant's whatapp_user_details row carries no value of its own.
const DEFAULT_WA_API_VERSION = 'v25.0'
const DEFAULT_WA_TEMPLATE = 'parents_'
const DEFAULT_WA_LANGUAGE = 'en_US'

interface RecipientResult {
  id: number | string
  name: string
  target: string
  status: 'sent' | 'failed' | 'skipped'
  deliveryStatus?: 'submitted' | 'delivered' | 'failed' | 'skipped'
  msgid?: string
  error?: string
  reason?: string
  directLink?: string
}

function cleanIndianMobile(raw: unknown): string | null {
  if (!raw) return null
  const str = String(raw).trim()
  if (!str) return null
  const digits = str.replace(/\D/g, '')
  let final10 = ''
  if (digits.length === 10) {
    final10 = digits
  } else if (digits.length === 12 && digits.startsWith(COUNTRY_CODE)) {
    final10 = digits.slice(2)
  } else if (digits.length === 11 && digits.startsWith('0')) {
    final10 = digits.slice(1)
  } else if (digits.length > 10) {
    final10 = digits.slice(-10)
  }
  if (final10.length === 10 && /^[6-9]\d{9}$/.test(final10)) {
    return final10
  }
  return null
}

function isValidEmail(email: unknown): boolean {
  if (!email || typeof email !== 'string') return false
  const trimmed = email.trim()
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)
}

export async function POST(request: NextRequest) {
  try {
    const auth = await resolveAuthenticatedTenant(request)
    if (!auth) {
      return NextResponse.json(
        { success: false, message: 'Your session is not valid. Please sign in again.' },
        { status: 401 },
      )
    }
    const { tenantId, userId } = auth

    const payload = (await request.json()) as BulkMessagePayload
    const { channel, relatedType = 'lead', ids = [] } = payload

    if (!ids || ids.length === 0) {
      return NextResponse.json(
        { success: false, message: 'No records were selected.' },
        { status: 400 },
      )
    }

    const cleanIds = ids
      .map((id, index) => {
        const num = Number(id)
        return !isNaN(num) && num > 0 ? num : index + 1
      })
      .filter((id) => id > 0)
    if (cleanIds.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Invalid record IDs provided.' },
        { status: 400 },
      )
    }

    const sharedSubject = (payload.subject || '').trim()
    const sharedBody = (payload.body || payload.message || '').trim()
    const sharedText = (payload.message || payload.body || '').trim()

    // A recipient may carry its own reviewed message; otherwise the shared text applies.
    const overrides = new Map<number, { subject: string; body: string }>()
    Object.entries(payload.messages || {}).forEach(([key, value]) => {
      const id = Number(key)
      const body = (value?.body || '').trim()
      if (Number.isInteger(id) && id > 0 && body) overrides.set(id, { subject: (value?.subject || '').trim(), body })
    })
    const everyoneHasOwn = cleanIds.every((id) => overrides.has(id))

    if (channel === 'email') {
      if (!sharedSubject && !(everyoneHasOwn && cleanIds.every((id) => overrides.get(id)?.subject))) {
        return NextResponse.json(
          { success: false, message: 'Email subject is required.' },
          { status: 400 },
        )
      }
      if (!sharedBody && !everyoneHasOwn) {
        return NextResponse.json(
          { success: false, message: 'Email body content is required.' },
          { status: 400 },
        )
      }
    } else if (channel === 'sms') {
      if (!sharedText && !everyoneHasOwn) {
        return NextResponse.json(
          { success: false, message: 'SMS message content is required.' },
          { status: 400 },
        )
      }
    } else if (channel === 'whatsapp') {
      if (!sharedText && !everyoneHasOwn) {
        return NextResponse.json(
          { success: false, message: 'WhatsApp message content is required.' },
          { status: 400 },
        )
      }
    }

    // 1. Map payload recipients by ID for client-side enrichment fallback
    const payloadRecMap = new Map<string, { id: string | number; name?: string; email?: string | null; phone?: string | null }>()
    if (Array.isArray(payload.recipients)) {
      payload.recipients.forEach((r) => {
        if (r && r.id != null) {
          payloadRecMap.set(String(r.id), r)
        }
      })
    }

    // 2. Fetch actual records from database
    let tableName = 'crm_leads'
    let linkedType = 'LEAD'
    const isCrmEntity = relatedType === 'lead' || relatedType === 'contact' || relatedType === 'organization'
    if (relatedType === 'contact') {
      tableName = 'crm_contacts'
      linkedType = 'CONTACT'
    } else if (relatedType === 'organization') {
      tableName = 'crm_organizations'
      linkedType = 'ORGANIZATION'
    }

    const recordMap = new Map<number, any>()
    if (isCrmEntity && cleanIds.length > 0) {
      const placeholders = cleanIds.map(() => '?').join(',')
      const querySql = `
        SELECT id, first_name, last_name, company, email, mobile, phone, sub_institute_id
        FROM ${tableName}
        WHERE id IN (${placeholders}) AND sub_institute_id = ?
      `
      const rows = (await dbQuery<any[]>(querySql, [...cleanIds, tenantId])) || []
      rows.forEach((r) => {
        recordMap.set(Number(r.id), r)
      })
    }

    const results: RecipientResult[] = []
    let sentCount = 0
    let failedCount = 0
    let skippedCount = 0
    let deliveredCount = 0
    let submittedCount = 0

    // Prepare channel credentials/gateways
    let transporter: Transporter | null = null
    let fromEmail = ''
    let fromName = ''

    if (channel === 'email') {
      try {
        const smtpRows = await dbQuery<any[]>(
          `SELECT * FROM smtp_details WHERE (sub_institute_id = ? OR module_key = 'default') AND (deleted_at IS NULL) ORDER BY (sub_institute_id = ?) DESC, id DESC LIMIT 1`,
          [tenantId, tenantId],
        )
        const smtp = smtpRows && smtpRows.length > 0 ? smtpRows[0] : null

        // No built-in mailbox: without a configured profile the send fails with a clear message.
        if (smtp?.server_address && smtp?.gmail && smtp?.password) {
          const port = Number(smtp.port) || 587
          fromEmail = smtp.gmail
          fromName = smtp.from_name || smtp.label || smtp.gmail

          transporter = nodemailer.createTransport({
            host: smtp.server_address,
            port,
            secure: port === 465,
            auth: {
              user: fromEmail,
              pass: smtp.password,
            },
            tls: {
              rejectUnauthorized: false,
            },
          })
        }
      } catch (e: any) {
        console.error('[BulkMessage] SMTP Transporter initialization error:', e)
      }
    }

    // Prepare SMS Gateway
    let smsGateway: { url: string; pram: string; mobile_var: string; text_var: string; last_var: string } | null = null

    if (channel === 'sms') {
      try {
        const smsRows = await dbQuery<any[]>(
          `SELECT * FROM sms_api_details WHERE sub_institute_id = ? ORDER BY id DESC LIMIT 1`,
          [tenantId],
        )
        if (smsRows && smsRows.length > 0 && smsRows[0].url) {
          smsGateway = {
            url: smsRows[0].url,
            pram: smsRows[0].pram || '',
            mobile_var: smsRows[0].mobile_var || '&number=',
            text_var: smsRows[0].text_var || '&message=',
            last_var: smsRows[0].last_var || '',
          }
        }
      } catch (e) {
        console.error('[BulkMessage] Error reading sms_api_details:', e)
      }
    }

    // Prepare WhatsApp Gateway
    let waAccount = {
      phone_number_id: '',
      access_token: '',
      version: DEFAULT_WA_API_VERSION,
      template: DEFAULT_WA_TEMPLATE,
      language: DEFAULT_WA_LANGUAGE,
      user_whatsapp_no: '',
    }

    if (channel === 'whatsapp') {
      try {
        const waRows = await dbQuery<any[]>(
          `SELECT * FROM whatapp_user_details WHERE sub_institute_id = ? ORDER BY id DESC LIMIT 1`,
          [tenantId],
        )
        if (waRows && waRows.length > 0) {
          const row = waRows[0]
          waAccount = {
            phone_number_id: row.cloud_api_phone_number_id || row.user_whatsapp_no || '',
            access_token: row.cloud_api_access_token || row.user_whatsapp_token || '',
            version: row.api_version || DEFAULT_WA_API_VERSION,
            template: row.template_name || DEFAULT_WA_TEMPLATE,
            language: row.template_language || DEFAULT_WA_LANGUAGE,
            user_whatsapp_no: row.user_whatsapp_no || '',
          }
        }
      } catch (e) {
        console.error('[BulkMessage] Error reading whatapp_user_details:', e)
      }
    }

    // 3. Iterate each requested ID and deliver
    for (let i = 0; i < cleanIds.length; i++) {
      const recordId = cleanIds[i]
      const idKey = String(recordId)
      const record = recordMap.get(recordId)
      const recPayload = payloadRecMap.get(idKey) || (Array.isArray(payload.recipients) ? payload.recipients[i] : undefined)

      // This recipient's reviewed message if there is one, otherwise the shared text.
      const own = overrides.get(recordId)
      const emailSubject = own?.subject || sharedSubject
      const emailBody = own?.body || sharedBody
      // Meta takes the WhatsApp text as one template variable, so it is flattened to what Meta accepts.
      const textMessage = channel === 'whatsapp' ? toWhatsappTemplateText(own?.body || sharedText) : own?.body || sharedText

      const recipientName =
        recPayload?.name ||
        (record ? `${record.first_name || ''} ${record.last_name || record.company || ''}`.trim() : null) ||
        (relatedType === 'communication' ? `Recipient #${recordId}` : `Lead #${recordId}`)

      const rawEmail = (recPayload?.email || record?.email || '').trim()
      const rawPhone = (recPayload?.phone || record?.mobile || record?.phone || '').trim()

      if (!record && !recPayload) {
        skippedCount++
        results.push({
          id: recordId,
          name: recipientName,
          target: '—',
          status: 'skipped',
          deliveryStatus: 'skipped',
          reason: 'Record not found in database or selection',
        })
        continue
      }

      // ── CHANNEL: EMAIL ──
      if (channel === 'email') {
        const email = rawEmail
        if (!isValidEmail(email)) {
          skippedCount++
          results.push({
            id: recordId,
            name: recipientName,
            target: email || '—',
            status: 'skipped',
            deliveryStatus: 'skipped',
            reason: 'No valid email address registered',
          })
          continue
        }

        if (!transporter) {
          failedCount++
          results.push({
            id: recordId,
            name: recipientName,
            target: email,
            status: 'failed',
            deliveryStatus: 'failed',
            error: 'SMTP mailbox profile is not configured or unavailable.',
          })
          continue
        }

        try {
          const info = await transporter.sendMail({
            from: `"${fromName}" <${fromEmail}>`,
            to: email,
            subject: emailSubject,
            text: emailBody,
            html: `<div style="font-family: sans-serif; line-height: 1.6; color: #1e293b;">${emailBody.replace(/\n/g, '<br/>')}</div>`,
          })

          // Insert into crm_emails and crm_email_links
          try {
            const insertResult: any = await dbQuery(
              `INSERT INTO crm_emails (subject, body, to_address, status, sent_at, created_by, sub_institute_id, created_at, updated_at, direction, from_address, message_id)
               VALUES (?, ?, ?, 'Sent', NOW(), ?, ?, NOW(), NOW(), 'outbound', ?, ?)`,
              [emailSubject, emailBody, email, userId, tenantId, fromEmail, info.messageId || ''],
            )
            const emailId = insertResult.insertId
            if (emailId && isCrmEntity) {
              await dbQuery(
                `INSERT INTO crm_email_links (email_id, linked_type, linked_id, sub_institute_id, created_by, created_at)
                 VALUES (?, ?, ?, ?, ?, NOW())`,
                [emailId, linkedType, recordId, tenantId, userId],
              )
            }
          } catch (dbErr) {
            console.warn('[BulkMessage] Could not log to crm_emails:', dbErr)
          }

          sentCount++
          deliveredCount++
          results.push({
            id: recordId,
            name: recipientName,
            target: email,
            status: 'sent',
            deliveryStatus: 'delivered',
            reason: 'Delivered to mailbox via SMTP',
          })
        } catch (mailErr: any) {
          failedCount++
          results.push({
            id: recordId,
            name: recipientName,
            target: email,
            status: 'failed',
            deliveryStatus: 'failed',
            error: mailErr?.message || 'SMTP delivery failed',
          })
        }
      }

      // ── CHANNEL: SMS ──
      else if (channel === 'sms') {
        const cleanMobile = cleanIndianMobile(rawPhone)

        if (!cleanMobile) {
          skippedCount++
          results.push({
            id: recordId,
            name: recipientName,
            target: rawPhone || '—',
            status: 'skipped',
            deliveryStatus: 'skipped',
            reason: 'No valid 10-digit mobile number registered on file',
          })
          continue
        }

        if (!smsGateway) {
          failedCount++
          results.push({
            id: recordId,
            name: recipientName,
            target: cleanMobile,
            status: 'failed',
            deliveryStatus: 'failed',
            error: 'SMS gateway is not configured in Settings → Email, SMS & WhatsApp.',
          })
          continue
        }

        try {
          const sendUrl = `${smsGateway.url}${smsGateway.pram}${smsGateway.mobile_var}${cleanMobile}${smsGateway.text_var}${encodeURIComponent(textMessage)}${smsGateway.last_var}`
          const smsResp = await fetch(sendUrl, { method: 'GET', cache: 'no-store' })
          const textResp = await smsResp.text()

          let parsedSms: any = null
          try {
            parsedSms = JSON.parse(textResp)
          } catch {
            parsedSms = null
          }

          const isFailure =
            !smsResp.ok ||
            textResp.includes('"FAILURE"') ||
            textResp.includes('"Invalid API Key"') ||
            textResp.toLowerCase().includes('error') ||
            (parsedSms && parsedSms.status !== 'OK' && parsedSms.status !== 1)

          const msgid = parsedSms?.msgid ? String(parsedSms.msgid) : null
          let finalDeliveryStatus: 'submitted' | 'delivered' | 'failed' = isFailure ? 'failed' : 'submitted'
          let deliveryDescription = ''

          if (isFailure) {
            deliveryDescription = parsedSms?.message || textResp.slice(0, 200) || 'Gateway rejection'
          } else if (msgid) {
            // Verify carrier DLR status using gateway message ID
            try {
              const apikeyMatch = smsGateway.pram.match(/apikey=([^&]+)/)
              const apikey = apikeyMatch ? apikeyMatch[1] : null
              // The delivery-report endpoint sits beside the send endpoint on the same gateway.
              const dlrUrl = apikey
                ? `${smsGateway.url.replace(/http-api\.php.*$/, 'http-dlr.php')}?apikey=${apikey}&msgid=${msgid}&format=json`
                : null
              const dlrResp = dlrUrl ? await fetch(dlrUrl, { method: 'GET', cache: 'no-store' }) : null
              if (dlrResp?.ok) {
                const dlrData = await dlrResp.json()
                const dlrItem = dlrData?.data?.[0]
                const statusDesc = (dlrItem?.status_desc || dlrItem?.status || '').toLowerCase()
                if (statusDesc === 'delivered') {
                  finalDeliveryStatus = 'delivered'
                  deliveryDescription = `Delivered to handset (Msg ID: ${msgid})`
                  deliveredCount++
                } else if (statusDesc === 'failed' || statusDesc === 'rejected') {
                  finalDeliveryStatus = 'failed'
                  deliveryDescription = `Carrier rejected (Msg ID: ${msgid}): ${dlrItem?.status_desc || 'Undelivered'}`
                } else {
                  finalDeliveryStatus = 'submitted'
                  deliveryDescription = `Submitted to gateway (Msg ID: ${msgid}, Status: ${dlrItem?.status_desc || 'Submitted'}). Awaiting carrier handset delivery.`
                  submittedCount++
                }
              } else {
                finalDeliveryStatus = 'submitted'
                deliveryDescription = `Submitted to gateway (Msg ID: ${msgid}). Awaiting carrier network delivery.`
                submittedCount++
              }
            } catch {
              finalDeliveryStatus = 'submitted'
              deliveryDescription = `Submitted to gateway (Msg ID: ${msgid}). Awaiting carrier network delivery.`
              submittedCount++
            }
          } else {
            finalDeliveryStatus = 'submitted'
            deliveryDescription = `Submitted to gateway (${textResp.slice(0, 80)}).`
            submittedCount++
          }

          // Log accurately in crm_sms_log
          try {
            await dbQuery(
              `INSERT INTO crm_sms_log (to_number, message, status, error_reason, related_type, related_id, sent_by, sub_institute_id, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
              [
                cleanMobile,
                textMessage,
                finalDeliveryStatus === 'failed' ? 'failed' : 'sent',
                deliveryDescription.slice(0, 255),
                relatedType,
                recordId,
                userId,
                tenantId,
              ],
            )
          } catch (dbErr) {
            console.warn('[BulkMessage] Could not log to crm_sms_log:', dbErr)
          }

          if (finalDeliveryStatus !== 'failed') {
            sentCount++
            results.push({
              id: recordId,
              name: recipientName,
              target: cleanMobile,
              status: 'sent',
              deliveryStatus: finalDeliveryStatus,
              msgid: msgid || undefined,
              reason: deliveryDescription,
            })
          } else {
            failedCount++
            results.push({
              id: recordId,
              name: recipientName,
              target: cleanMobile,
              status: 'failed',
              deliveryStatus: 'failed',
              error: `SMS Gateway error: ${deliveryDescription}`,
            })
          }
        } catch (smsErr: any) {
          failedCount++
          results.push({
            id: recordId,
            name: recipientName,
            target: cleanMobile,
            status: 'failed',
            deliveryStatus: 'failed',
            error: smsErr?.message || 'Gateway network error',
          })
        }
      }

      // ── CHANNEL: WHATSAPP ──
      else if (channel === 'whatsapp') {
        const cleanMobile = cleanIndianMobile(rawPhone)

        if (!cleanMobile) {
          skippedCount++
          results.push({
            id: recordId,
            name: recipientName,
            target: rawPhone || '—',
            status: 'skipped',
            deliveryStatus: 'skipped',
            reason: 'No valid WhatsApp mobile number registered on file',
          })
          continue
        }

        let isSuccess = false
        let waResultError: string | null = null
        let waMsgId: string | undefined = undefined
        const directChatUrl = `https://wa.me/${COUNTRY_CODE}${cleanMobile}?text=${encodeURIComponent(textMessage)}`

        // 1. Meta WhatsApp Cloud API check
        const hasValidToken =
          waAccount.access_token &&
          waAccount.phone_number_id &&
          !waAccount.access_token.includes('...') &&
          waAccount.access_token.length > 20

        if (hasValidToken) {
          try {
            const metaUrl = `https://graph.facebook.com/${waAccount.version}/${waAccount.phone_number_id}/messages`
            const waBody = {
              messaging_product: 'whatsapp',
              to: `${COUNTRY_CODE}${cleanMobile}`,
              type: 'template',
              template: {
                name: waAccount.template,
                language: { code: waAccount.language },
                components: [{ type: 'body', parameters: [{ type: 'text', text: textMessage }] }],
              },
            }

            const metaResp = await fetch(metaUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${waAccount.access_token}`,
              },
              body: JSON.stringify(waBody),
            })
            const metaJson = await metaResp.json()

            if (metaResp.ok && metaJson?.messages?.[0]?.id) {
              isSuccess = true
              waMsgId = metaJson.messages[0].id
              deliveredCount++
            } else {
              const err = metaJson?.error
              waResultError = err ? `Meta Cloud API [Code ${err.code || metaResp.status}]: ${err.message}` : `Meta API HTTP ${metaResp.status}`
            }
          } catch (e: any) {
            waResultError = e?.message || 'Meta Cloud API call error'
          }
        } else {
          // Token is placeholder or not configured in settings
          waResultError = 'Meta WhatsApp Cloud API Access Token is not yet configured with a valid permanent token in Settings → Email, SMS & WhatsApp.'
        }

        // Log into crm_sms_log accurately
        try {
          await dbQuery(
            `INSERT INTO crm_sms_log (to_number, message, status, error_reason, related_type, related_id, sent_by, sub_institute_id, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
            [
              `${COUNTRY_CODE}${cleanMobile}`,
              `[WhatsApp] ${textMessage}`,
              isSuccess ? 'sent' : 'failed',
              isSuccess ? (waMsgId ? `Delivered via Meta Cloud API [MsgID: ${waMsgId}]` : 'Delivered') : waResultError?.slice(0, 255) || 'Failed',
              relatedType,
              recordId,
              userId,
              tenantId,
            ],
          )
        } catch (dbErr) {
          console.warn('[BulkMessage] Could not log WhatsApp:', dbErr)
        }

        if (isSuccess) {
          sentCount++
          results.push({
            id: recordId,
            name: recipientName,
            target: `+${COUNTRY_CODE} ${cleanMobile}`,
            status: 'sent',
            deliveryStatus: 'delivered',
            msgid: waMsgId,
            reason: 'Delivered via Meta WhatsApp Cloud API',
          })
        } else {
          failedCount++
          results.push({
            id: recordId,
            name: recipientName,
            target: `+${COUNTRY_CODE} ${cleanMobile}`,
            status: 'failed',
            deliveryStatus: 'failed',
            error: waResultError || 'WhatsApp dispatch could not be completed.',
            directLink: directChatUrl,
          })
        }
      }
    }

    const channelLabel = channel === 'email' ? 'Email' : channel === 'sms' ? 'SMS' : 'WhatsApp'
    let summaryMessage = ''

    if (channel === 'sms') {
      if (deliveredCount > 0 && failedCount === 0 && skippedCount === 0) {
        summaryMessage = `${deliveredCount} SMS message(s) delivered to recipient handset(s).`
      } else if (submittedCount > 0 && failedCount === 0 && skippedCount === 0) {
        summaryMessage = `${submittedCount} SMS message(s) submitted to gateway (Status: Submitted). Delivery to handset is pending carrier network.`
      } else if (sentCount > 0) {
        summaryMessage = `${sentCount} sent (${deliveredCount} delivered, ${submittedCount} submitted), ${failedCount} failed, ${skippedCount} skipped.`
      } else if (failedCount > 0) {
        summaryMessage = `SMS submission failed for ${failedCount} record(s).`
      } else {
        summaryMessage = `0 sent: ${skippedCount} selected recipient(s) do not have a registered mobile number.`
      }
    } else if (channel === 'whatsapp') {
      if (sentCount > 0 && failedCount === 0 && skippedCount === 0) {
        summaryMessage = `${sentCount} WhatsApp message(s) delivered successfully via Meta Cloud API.`
      } else if (sentCount > 0) {
        summaryMessage = `${sentCount} sent, ${failedCount} failed, ${skippedCount} skipped of ${cleanIds.length} record(s).`
      } else if (failedCount > 0) {
        summaryMessage = `WhatsApp dispatch failed for ${failedCount} record(s): ${results[0]?.error || 'Credentials not verified.'}`
      } else {
        summaryMessage = `0 sent: ${skippedCount} selected recipient(s) do not have a registered WhatsApp number.`
      }
    } else {
      // Email
      if (sentCount > 0 && failedCount === 0 && skippedCount === 0) {
        summaryMessage = `${sentCount} email message(s) delivered successfully.`
      } else if (sentCount > 0) {
        summaryMessage = `${sentCount} sent, ${failedCount} failed, ${skippedCount} skipped of ${cleanIds.length} record(s).`
      } else if (failedCount > 0) {
        summaryMessage = `Email delivery failed for ${failedCount} record(s).`
      } else {
        summaryMessage = `0 sent: ${skippedCount} selected recipient(s) do not have a registered email address.`
      }
    }

    return NextResponse.json({
      success: sentCount > 0 || (skippedCount > 0 && failedCount === 0),
      message: summaryMessage,
      data: {
        total: cleanIds.length,
        sent: sentCount,
        delivered: deliveredCount,
        submitted: submittedCount,
        failed: failedCount,
        skipped: skippedCount,
        results,
      },
    })
  } catch (error: any) {
    console.error('[BulkMessage API] Unexpected error:', error)
    return NextResponse.json(
      {
        success: false,
        message: error?.message || 'An unexpected error occurred while processing bulk message dispatch.',
      },
      { status: 500 },
    )
  }
}
