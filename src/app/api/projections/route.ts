import { NextRequest, NextResponse } from 'next/server'
import { dataAdapter } from '@/lib/prisma-adapter'

const getCurrentUserId = () => 'user-1' // TODO: Replace with actual auth

export async function GET(request: NextRequest) {
  try {
    const userId = getCurrentUserId()
    const { searchParams } = new URL(request.url)
    
    const accountId = searchParams.get('accountId') ?? undefined
    const startDate = searchParams.get('startDate') ? new Date(searchParams.get('startDate')!) : new Date()
    const endDate = searchParams.get('endDate') ? new Date(searchParams.get('endDate')!) : new Date(Date.now() + 60 * 24 * 60 * 60 * 1000) // 60 days default

    const projections = await dataAdapter.getProjections(userId, {
      accountId,
      startDate,
      endDate,
    })

    return NextResponse.json(projections)
  } catch (error) {
    console.error('Error fetching projections:', error)
    return NextResponse.json({ error: 'Failed to fetch projections' }, { status: 500 })
  }
}
