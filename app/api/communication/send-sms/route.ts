import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

interface SmsRequestBody {
  numbers?: string[] | string
  mobile?: string[] | string
  message?: string
  smsText?: string
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
 * POST /api/communication/send-sms
 *
 * Dispatches SMS to students and parents using LMS K-12's backend services
 * (teacherSendSmsParentsAPI with add_adminSendSmsAPI fallback).
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as SmsRequestBody
    const message = (body.message || body.smsText || '').trim()
    if (!message) {
      return NextResponse.json(
        { success: false, message: 'Message text is required.' },
        { status: 400 },
      )
    }

    const rawNumbers = body.numbers || body.mobile || []
    const cleanNumbers = extractClean10DigitNumbers(rawNumbers)

    if (cleanNumbers.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: 'At least one valid 10-digit mobile number is required.',
        },
        { status: 400 },
      )
    }

    const authHeader = request.headers.get('authorization') || ''
    const cookieHeader = request.headers.get('cookie') || ''

    // Delegate directly to G2G's existing CRM bulk-message SMS integration
    const recipients = cleanNumbers.map((num, index) => ({
      id: index + 1,
      phone: num,
      name: `Recipient ${index + 1}`,
    }))

    const crmBulkUrl = new URL('/api/crm/bulk-message', request.nextUrl.origin)
    const resp = await fetch(crmBulkUrl.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader ? { Authorization: authHeader } : {}),
        ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      },
      body: JSON.stringify({
        channel: 'sms',
        relatedType: 'communication',
        ids: recipients.map((r) => r.id),
        recipients,
        message,
      }),
      cache: 'no-store',
    })

    const bulkData = await resp.json().catch(() => null)
    if (resp.ok && bulkData?.success) {
      return NextResponse.json({
        success: true,
        message: bulkData.message || `${cleanNumbers.length} SMS sent successfully via SMS gateway.`,
        sentCount: bulkData?.data?.sent ?? cleanNumbers.length,
        numbers: cleanNumbers,
        data: bulkData.data,
      })
    }

    const failureReason =
      bulkData?.message ||
      bulkData?.data?.results?.[0]?.error ||
      'SMS Gateway reported an error. Please verify SMS API details.'

    return NextResponse.json(
      {
        success: false,
        message: failureReason,
        sentCount: 0,
        numbers: cleanNumbers,
        data: bulkData?.data,
      },
      { status: 422 },
    )
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        message: err?.message || 'Server error while sending SMS.',
      },
      { status: 500 },
    )
  }
}
