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
    const transaction = await dataAdapter.getTransaction(userId, params.id)

    if (!transaction) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
    }

    // Convert LogicalDate objects to calendar date strings (YYYY-MM-DD)
    const response = {
      ...transaction,
      date: transaction.date.toString(),
      ...(transaction.recurrence?.endDate && {
        recurrence: {
          ...transaction.recurrence,
          endDate: transaction.recurrence.endDate.toString(),
        },
      }),
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error fetching transaction:', error)
    return NextResponse.json({ error: 'Failed to fetch transaction' }, { status: 500 })
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

    // Ensure amount is a number (not a string) and preserve sign
    if (body.amount !== undefined) {
      body.amount = typeof body.amount === 'string' ? parseFloat(body.amount) : Number(body.amount)
    }

    // Convert calendar date strings (YYYY-MM-DD) to LogicalDate
    if (body.date) {
      body.date = LogicalDate.fromString(body.date)
    }
    
    // Handle recurrence endDate similarly
    if (body.recurrence?.endDate) {
      body.recurrence.endDate = LogicalDate.fromString(body.recurrence.endDate)
    }

    const transaction = await dataAdapter.updateTransaction(userId, params.id, body)
    
    // Convert response back to calendar date string (YYYY-MM-DD)
    const response = {
      ...transaction,
      date: transaction.date.toString(),
      ...(transaction.recurrence?.endDate && {
        recurrence: {
          ...transaction.recurrence,
          endDate: transaction.recurrence.endDate.toString(),
        },
      }),
    }
    
    return NextResponse.json(response)
  } catch (error) {
    console.error('Error updating transaction:', error)
    return NextResponse.json({ error: 'Failed to update transaction' }, { status: 500 })
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
    await dataAdapter.deleteTransaction(userId, params.id)
    return new NextResponse(null, { status: 204 })
  } catch (error) {
    console.error('Error deleting transaction:', error)
    return NextResponse.json({ error: 'Failed to delete transaction' }, { status: 500 })
  }
}
