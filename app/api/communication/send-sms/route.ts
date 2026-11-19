import { NextRequest, NextResponse } from 'next/server'
import { resolveWebBaseUrl } from '@/lib/api-config'

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
    const base = resolveWebBaseUrl().replace(/\/$/, '')

    // Convert numbers array to the indexed map expected by teacherSendSmsParentsAPI and add_adminSendSmsAPI
    const mobileMap: Record<string, string> = {}
    cleanNumbers.forEach((num, index) => {
      mobileMap[String(index)] = num
    })

    const subInstituteId = body.sub_institute_id || '1'
    const syear = body.syear || String(new Date().getFullYear())
    const userId = body.user_id || '1'

    // 1. Try teacherSendSmsParentsAPI (which executes send_sms_parents_controller::sendSMS)
    const teacherPayload = {
      type: 'API',
      teacher_id: userId,
      sub_institute_id: subInstituteId,
      syear,
      sms_text: message,
      mobile_number: mobileMap,
    }

    let backendResult: any = null
    let endpointUsed = 'teacherSendSmsParentsAPI'

    try {
      const resp = await fetch(`${base}/teacherSendSmsParentsAPI`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(authHeader ? { Authorization: authHeader } : {}),
          ...(cookieHeader ? { Cookie: cookieHeader } : {}),
        },
        body: JSON.stringify(teacherPayload),
        cache: 'no-store',
      })

      const text = await resp.text()
      try {
        backendResult = text ? JSON.parse(text) : null
      } catch {
        backendResult = { raw: text }
      }
    } catch {
      // If direct call fails, try admin send SMS
    }

    // 2. If teacherSendSmsParentsAPI returned failure or 404, try add_adminSendSmsAPI
    if (
      !backendResult ||
      backendResult.status === '2' ||
      backendResult.status_code === 0 ||
      backendResult.status_code === '0'
    ) {
      const adminPayload = {
        admin_id: userId,
        sub_institute_id: subInstituteId,
        syear,
        sms_text: message,
        mobile_number: mobileMap,
      }

      try {
        const respAdmin = await fetch(`${base}/add_adminSendSmsAPI`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            ...(authHeader ? { Authorization: authHeader } : {}),
            ...(cookieHeader ? { Cookie: cookieHeader } : {}),
          },
          body: JSON.stringify(adminPayload),
          cache: 'no-store',
        })
        const textAdmin = await respAdmin.text()
        const parsedAdmin = textAdmin ? JSON.parse(textAdmin) : null
        if (parsedAdmin && (parsedAdmin.status_code === 1 || parsedAdmin.status_code === '1')) {
          backendResult = parsedAdmin
          endpointUsed = 'add_adminSendSmsAPI'
        } else if (parsedAdmin && parsedAdmin.message) {
          backendResult = parsedAdmin
          endpointUsed = 'add_adminSendSmsAPI'
        }
      } catch {
        // keep prior result
      }
    }

    const statusCode = backendResult?.status_code ?? backendResult?.status ?? 0
    const isSuccess =
      statusCode === 1 ||
      statusCode === '1' ||
      backendResult?.message === 'Successfully sent SMS' ||
      backendResult?.message === 'Successfully Sent SMS' ||
      backendResult?.success === true

    if (isSuccess) {
      return NextResponse.json({
        success: true,
        message: `${cleanNumbers.length} SMS sent successfully via SMS gateway (${endpointUsed}).`,
        sentCount: cleanNumbers.length,
        numbers: cleanNumbers,
        data: backendResult,
      })
    }

    const failureReason =
      backendResult?.message ||
      (backendResult?.response ? JSON.stringify(backendResult.response) : '') ||
      'SMS Gateway reported an error. Please verify SMS API details.'

    return NextResponse.json(
      {
        success: false,
        message: failureReason,
        sentCount: 0,
        numbers: cleanNumbers,
        data: backendResult,
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
