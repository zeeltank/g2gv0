import { NextRequest, NextResponse } from 'next/server'
import { readLaravelSession } from '@/lib/laravel-session'
import { resolveHpApiBaseUrl, resolveHpApiKey } from '@/lib/api-config'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const jobRoleId = searchParams.get('jobRoleId')

  if (!jobRoleId) {
    return NextResponse.json({ message: 'jobRoleId is required' }, { status: 400 })
  }

  const session = readLaravelSession()
  if (!session) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  }

  try {
    const hpBase = resolveHpApiBaseUrl()
    const hpApiKey = resolveHpApiKey()
    const subInstituteId = session.sub_institute_id ?? ''

    const params = new URLSearchParams({
      table: 's_user_jobrole_task',
      'filters[sub_institute_id]': String(subInstituteId),
      group_by: 'jobrole',
    })

    if (hpApiKey) {
      params.set('api_key', hpApiKey)
    }

    const url = `${hpBase}/table_data?${params.toString()}`

    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    })

    if (!response.ok) {
      const body = await response.text()
      throw new Error(`HP API error: ${response.status} ${body}`)
    }

    const rawData = await response.json()
    const records = Array.isArray(rawData) ? rawData : []

    const filtered = records.filter(
      (record: Record<string, unknown>) =>
        record.jobrole != null &&
        record.task != null &&
        String(record.jobrole) === jobRoleId,
    )

    const data = filtered.map((record: Record<string, unknown>) => ({
      id: String(record.id ?? ''),
      task_title: String(record.task ?? ''),
      task_description: '',
    }))

    return NextResponse.json({
      status: 200,
      message: 'OK',
      data,
    })
  } catch (error) {
    console.error('Job role tasks proxy error:', error)
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Failed to fetch job role tasks' },
      { status: 500 },
    )
  }
}