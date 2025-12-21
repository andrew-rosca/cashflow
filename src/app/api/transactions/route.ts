import { NextRequest, NextResponse } from 'next/server'
import { dataAdapter } from '@/lib/prisma-adapter'

const getCurrentUserId = () => 'user-1' // TODO: Replace with actual auth

export async function GET(request: NextRequest) {
  try {
    const userId = getCurrentUserId()
    const { searchParams } = new URL(request.url)
    
    const filters = {
      accountId: searchParams.get('accountId') ?? undefined,
      startDate: searchParams.get('startDate') ? new Date(searchParams.get('startDate')!) : undefined,
      endDate: searchParams.get('endDate') ? new Date(searchParams.get('endDate')!) : undefined,
      recurring: searchParams.get('recurring') ? searchParams.get('recurring') === 'true' : undefined,
    }

    const transactions = await dataAdapter.getTransactions(userId, filters)
    return NextResponse.json(transactions)
  } catch (error) {
    console.error('Error fetching transactions:', error)
    return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = getCurrentUserId()
    const body = await request.json()

    // Parse date as local date to avoid timezone shifts
    if (body.date) {
      const dateStr = typeof body.date === 'string' ? body.date : body.date.toISOString()
      // Extract date part and create at local midnight
      const dateOnly = dateStr.split('T')[0]
      body.date = new Date(dateOnly + 'T00:00:00')
    }
    
    // Handle recurrence endDate similarly
    if (body.recurrence?.endDate) {
      const dateStr = typeof body.recurrence.endDate === 'string' ? body.recurrence.endDate : body.recurrence.endDate.toISOString()
      const dateOnly = dateStr.split('T')[0]
      body.recurrence.endDate = new Date(dateOnly + 'T00:00:00')
    }

    const transaction = await dataAdapter.createTransaction(userId, body)
    return NextResponse.json(transaction, { status: 201 })
  } catch (error) {
    console.error('Error creating transaction:', error)
    return NextResponse.json({ error: 'Failed to create transaction' }, { status: 500 })
  }
}
