import { NextRequest, NextResponse } from 'next/server'
import { dataAdapter } from '@/lib/prisma-adapter'
import { LogicalDate } from '@/lib/logical-date'
import { getCurrentUserId } from '@/lib/auth'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await getCurrentUserId()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const account = await dataAdapter.getAccount(userId, params.id)

    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }

    // Convert LogicalDate to calendar date string (YYYY-MM-DD)
    const response = {
      ...account,
      balanceAsOf: account.balanceAsOf.toString(),
    }

    return NextResponse.json(response)
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
    const userId = await getCurrentUserId()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const body = await request.json()

    // Convert calendar date string (YYYY-MM-DD) to LogicalDate
    if (body.balanceAsOf) {
      body.balanceAsOf = LogicalDate.fromString(body.balanceAsOf)
    }

    const account = await dataAdapter.updateAccount(userId, params.id, body)
    
    // Convert response back to calendar date string (YYYY-MM-DD)
    const response = {
      ...account,
      balanceAsOf: account.balanceAsOf.toString(),
    }
    
    return NextResponse.json(response)
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
    const userId = await getCurrentUserId()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    await dataAdapter.deleteAccount(userId, params.id)
    return new NextResponse(null, { status: 204 })
  } catch (error) {
    console.error('Error deleting account:', error)
    return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 })
  }
}
