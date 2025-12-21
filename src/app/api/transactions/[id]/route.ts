import { NextRequest, NextResponse } from 'next/server'
import { dataAdapter } from '@/lib/prisma-adapter'

const getCurrentUserId = () => 'user-1' // TODO: Replace with actual auth

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = getCurrentUserId()
    const transaction = await dataAdapter.getTransaction(userId, params.id)

    if (!transaction) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
    }

    return NextResponse.json(transaction)
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

    const transaction = await dataAdapter.updateTransaction(userId, params.id, body)
    return NextResponse.json(transaction)
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
    const userId = getCurrentUserId()
    await dataAdapter.deleteTransaction(userId, params.id)
    return new NextResponse(null, { status: 204 })
  } catch (error) {
    console.error('Error deleting transaction:', error)
    return NextResponse.json({ error: 'Failed to delete transaction' }, { status: 500 })
  }
}
