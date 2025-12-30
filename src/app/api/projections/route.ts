import { NextRequest, NextResponse } from 'next/server'
import { PrismaDataAdapter } from '@/lib/prisma-adapter'
import { LogicalDate } from '@/lib/logical-date'
import { getCurrentUserId } from '@/lib/auth'

// In test mode, create fresh adapter on each request to avoid caching issues
// In production, we'd use the singleton for performance
function getDataAdapter() {
  if (process.env.NODE_ENV === 'test') {
    // Create fresh adapter with fresh Prisma client
    // This ensures we always use the current DATABASE_URL
    return new PrismaDataAdapter()
  }
  // Import singleton only in non-test mode to avoid circular dependency issues
  const { dataAdapter } = require('@/lib/prisma-adapter')
  return dataAdapter
}

export async function GET(request: NextRequest) {
  try {
    const userId = await getCurrentUserId()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
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

    const adapter = getDataAdapter()
    
    const projections = await adapter.getProjections(userId, {
      accountId,
      startDate,
      endDate,
    })
    
    const headers: Record<string, string> = {
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      'Pragma': 'no-cache',
      'Expires': '0',
    }

    // Convert LogicalDate objects to calendar date strings (YYYY-MM-DD) for the response
    const projectionsWithPlainDates = projections.map((proj: any) => ({
      ...proj,
      date: proj.date.toString(),
    }))

    // Prevent caching to ensure projections are always fresh
    return NextResponse.json(projectionsWithPlainDates, { headers })
  } catch (error) {
    console.error('Error fetching projections:', error)
    return NextResponse.json({ error: 'Failed to fetch projections' }, { status: 500 })
  }
}
