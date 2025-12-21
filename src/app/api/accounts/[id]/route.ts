import { NextRequest, NextResponse } from 'next/server'
import { dataAdapter } from '@/lib/prisma-adapter'

const getCurrentUserId = () => 'user-1' // TODO: Replace with actual auth

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = getCurrentUserId()
    const account = await dataAdapter.getAccount(userId, params.id)

    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }

    return NextResponse.json(account)
  } catch (error) {
    console.error('Error fetching account:', error)
    return NextResponse.json({ error: 'Failed to fetch account' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = getCurrentUserId()
    const body = await request.json()

    // Parse balanceAsOf as UTC date to avoid timezone shifts
    if (body.balanceAsOf) {
      const dateStr = typeof body.balanceAsOf === 'string' ? body.balanceAsOf : body.balanceAsOf.toISOString()
      // Extract date part and create at UTC midnight to avoid timezone shifts
      const dateOnly = dateStr.split('T')[0]
      const [year, month, day] = dateOnly.split('-').map(Number)
      // Create date using UTC to avoid timezone conversion issues
      const parsedDate = new Date(Date.UTC(year, month - 1, day))
      console.log('[API PUT] Received date:', body.balanceAsOf, '-> extracted:', dateOnly, '-> year/month/day:', year, month, day, '-> parsed year:', parsedDate.getUTCFullYear(), 'UTC date:', parsedDate.toISOString(), 'timestamp:', parsedDate.getTime())
      body.balanceAsOf = parsedDate
    }

    const account = await dataAdapter.updateAccount(userId, params.id, body)
    const returnedDate = account.balanceAsOf
    const returnedISO = typeof returnedDate === 'string' ? returnedDate : returnedDate.toISOString()
    const returnedYear = typeof returnedDate === 'string' ? returnedDate.split('T')[0].split('-')[0] : returnedDate.getUTCFullYear()
    console.log('[API PUT] Account after update - balanceAsOf:', returnedISO, 'type:', typeof returnedDate, 'year:', returnedYear, 'timestamp:', typeof returnedDate === 'object' ? returnedDate.getTime() : 'N/A')
    return NextResponse.json(account)
  } catch (error) {
    console.error('Error updating account:', error)
    return NextResponse.json({ error: 'Failed to update account' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = getCurrentUserId()
    await dataAdapter.deleteAccount(userId, params.id)
    return new NextResponse(null, { status: 204 })
  } catch (error) {
    console.error('Error deleting account:', error)
    return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 })
  }
}
