import { NextRequest, NextResponse } from 'next/server'
import { dataAdapter } from '@/lib/prisma-adapter'
import { LogicalDate } from '@/lib/logical-date'

const getCurrentUserId = () => 'user-1' // TODO: Replace with actual auth

export async function GET(request: NextRequest) {
  try {
    const userId = getCurrentUserId()
    const { searchParams } = new URL(request.url)
    
    const accountId = searchParams.get('accountId') ?? undefined
    // Require explicit date parameters - no "today" concept on server
    const startDateParam = searchParams.get('startDate')
    const endDateParam = searchParams.get('endDate')
    
    if (!startDateParam || !endDateParam) {
      return NextResponse.json(
        { error: 'startDate and endDate query parameters are required' },
        { status: 400 }
      )
    }
    
    const startDate = LogicalDate.fromString(startDateParam)
    const endDate = LogicalDate.fromString(endDateParam)

    const projections = await dataAdapter.getProjections(userId, {
      accountId,
      startDate,
      endDate,
    })

    // Convert LogicalDate objects to calendar date strings (YYYY-MM-DD) for the response
    const projectionsWithPlainDates = projections.map(proj => ({
      ...proj,
      date: proj.date.toString(),
    }))

    // Prevent caching to ensure projections are always fresh
    return NextResponse.json(projectionsWithPlainDates, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    })
  } catch (error) {
    console.error('Error fetching projections:', error)
    return NextResponse.json({ error: 'Failed to fetch projections' }, { status: 500 })
  }
}
