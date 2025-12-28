import { NextRequest, NextResponse } from 'next/server'
import { PrismaDataAdapter } from '@/lib/prisma-adapter'
import { LogicalDate } from '@/lib/logical-date'

const getCurrentUserId = () => 'user-1' // TODO: Replace with actual auth

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

    const adapter = getDataAdapter()
    
    // In test mode, log debug info
    if (process.env.NODE_ENV === 'test') {
      const dbUrl = process.env.DATABASE_URL
      console.error('[projections API] DATABASE_URL:', dbUrl?.substring(0, 80))
      console.error('[projections API] Request params - accountId:', accountId, 'startDate:', startDateParam, 'endDate:', endDateParam)
    }
    
    const projections = await adapter.getProjections(userId, {
      accountId,
      startDate,
      endDate,
    })
    
    // In test mode, add debug info to response headers
    const headers: Record<string, string> = {
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      'Pragma': 'no-cache',
      'Expires': '0',
    }
    
    if (process.env.NODE_ENV === 'test') {
      headers['X-Debug-Database-URL'] = (process.env.DATABASE_URL || 'not-set').substring(0, 50)
      headers['X-Debug-Projections-Count'] = projections.length.toString()
      console.error('[projections API] Returning', projections.length, 'projections')
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
