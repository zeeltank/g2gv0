import { NextRequest, NextResponse } from 'next/server'
import { readLaravelSession } from '@/lib/laravel-session'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const taskTitle = searchParams.get('taskTitle')

  if (!taskTitle) {
    return NextResponse.json({ message: 'taskTitle is required' }, { status: 400 })
  }

  const session = readLaravelSession()
  if (!session) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  }

  try {
    const laravelBase = process.env.NEXT_PUBLIC_API_BASE_URL_DEV ?? process.env.NEXT_PUBLIC_API_BASE_URL_PROD ?? ''
    const base = laravelBase.endsWith('/api') ? laravelBase : `${laravelBase}/api`

    const subInstituteId = session.sub_institute_id ?? ''
    const token = session.token ?? ''
    const syear = session.syear ?? ''

    const response = await fetch(
      `${base}/jobrole-task-description?task_title=${encodeURIComponent(taskTitle)}&sub_institute_id=${encodeURIComponent(subInstituteId)}&token=${encodeURIComponent(token)}&syear=${encodeURIComponent(syear)}`,
      {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      },
    )

    if (!response.ok) {
      const body = await response.text()
      throw new Error(`Laravel API error: ${response.status} ${body}`)
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Job role task description proxy error:', error)
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Failed to fetch task description' },
      { status: 500 },
    )
  }
}