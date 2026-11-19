import { NextRequest, NextResponse } from 'next/server'
import { resolveWebBaseUrl } from '@/lib/api-config'

export const runtime = 'nodejs'

interface WhatsappRequestBody {
  numbers?: string[] | string
  mobile?: string[] | string
  message?: string
  module?: string
  subject?: string
  sub_institute_id?: string | number
  syear?: string | number
  user_id?: string | number
}

/**
 * Normalizes raw numbers into a clean list of 10-digit Indian phone strings.
 * Reused from LMS K-12 communication service.
 */
function extractClean10DigitNumbers(raw: unknown): string[] {
  const list: string[] = []
  if (Array.isArray(raw)) {
    raw.forEach((item) => list.push(String(item)))
  } else if (typeof raw === 'string') {
    list.push(...raw.split(/[,;\n]+/))
  }

  const cleaned: string[] = []
  list.forEach((item) => {
    const trimmed = item.trim()
    if (!trimmed) return
    const digits = trimmed.replace(/\D/g, '')
    let final10 = ''
    if (digits.length === 10) {
      final10 = digits
    } else if (digits.length === 12 && digits.startsWith('91')) {
      final10 = digits.slice(2)
    } else if (digits.length === 11 && digits.startsWith('0')) {
      final10 = digits.slice(1)
    } else if (digits.length > 10) {
      final10 = digits.slice(-10)
    }
    if (final10.length === 10 && /^[6-9]\d{9}$/.test(final10)) {
      if (!cleaned.includes(final10)) {
        cleaned.push(final10)
      }
    }
  })

  return cleaned
}

/**
 * POST /api/communication/send-whatsapp
 *
 * Dispatches WhatsApp messages to students and parents using LMS K-12's
 * Meta WhatsApp Cloud API backend (/whatsapp-send-reply-messages/store).
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as WhatsappRequestBody
    let message = (body.message || '').trim()
    if (!message) {
      return NextResponse.json(
        { success: false, message: 'WhatsApp message text is required.' },
        { status: 400 },
      )
    }

    // Normalize Unicode curly quotes and unverified placeholder URLs to prevent Meta Cloud API delivery blockage
    message = message
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/https?:\/\/scholar\.app\/download/gi, 'Google Play Store / Apple App Store')

    const rawNumbers = body.numbers || body.mobile || []
    const cleanNumbers = extractClean10DigitNumbers(rawNumbers)

    if (cleanNumbers.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: 'At least one valid 10-digit mobile number is required for WhatsApp.',
        },
        { status: 400 },
      )
    }

    const authHeader = request.headers.get('authorization') || ''
    const cookieHeader = request.headers.get('cookie') || ''
    const base = resolveWebBaseUrl().replace(/\/$/, '')

    const subInstituteId = body.sub_institute_id || '1'
    const syear = body.syear || String(new Date().getFullYear())

    let sentCount = 0
    let failedCount = 0
    let lastError = ''
    const results: Array<{ number: string; success: boolean; error?: string }> = []

    // For each mobile number, invoke the ERP WhatsApp dispatch endpoint:
    // POST /whatsapp-send-reply-messages/store
    // (This uses WhatsappController::sendWhatsappCloudApi with the institute's cloud_api_access_token)
    for (const num of cleanNumbers) {
      const wid = `91${num}`
      const payload = {
        type: 'API',
        wid,
        message,
        sub_institute_id: subInstituteId,
        syear,
      }

      try {
        const resp = await fetch(`${base}/whatsapp-send-reply-messages/store`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            ...(authHeader ? { Authorization: authHeader } : {}),
            ...(cookieHeader ? { Cookie: cookieHeader } : {}),
          },
          body: JSON.stringify(payload),
          cache: 'no-store',
        })

        const text = await resp.text()
        let parsed: any = null
        try {
          parsed = text ? JSON.parse(text) : null
        } catch {
          parsed = { raw: text }
        }

        const isExplicitError =
          !resp.ok ||
          parsed?.status === '0' ||
          parsed?.status_code === 0 ||
          parsed?.status_code === '0' ||
          parsed?.message === 'WhatsApp configuration missing' ||
          parsed?.message === 'Oops ! something went wrong' ||
          Boolean(parsed?.error)

        const isSuccess = resp.ok && !isExplicitError

        if (isSuccess) {
          sentCount++
          results.push({ number: num, success: true })
        } else {
          failedCount++
          const err =
            parsed?.message ||
            (parsed?.error ? JSON.stringify(parsed.error) : 'WhatsApp Cloud API dispatch failed.')
          lastError = err
          results.push({ number: num, success: false, error: err })
        }
      } catch (e: any) {
        failedCount++
        lastError = e?.message || 'Network error communicating with WhatsApp endpoint.'
        results.push({ number: num, success: false, error: lastError })
      }
    }

    if (sentCount > 0) {
      const msg =
        failedCount > 0
          ? `${sentCount} WhatsApp message(s) sent, ${failedCount} failed.`
          : `${sentCount} WhatsApp message(s) sent successfully via Meta Cloud API.`

      return NextResponse.json({
        success: true,
        message: msg,
        sentCount,
        failedCount,
        numbers: cleanNumbers,
        results,
      })
    }

    return NextResponse.json(
      {
        success: false,
        message: lastError || 'Failed to dispatch WhatsApp messages. Please verify WhatsApp Cloud API setup.',
        sentCount: 0,
        failedCount,
        numbers: cleanNumbers,
        results,
      },
      { status: 422 },
    )
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        message: err?.message || 'Server error while sending WhatsApp message.',
      },
      { status: 500 },
    )
  }
}
