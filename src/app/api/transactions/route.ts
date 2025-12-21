import { NextRequest, NextResponse } from 'next/server'
import { dataAdapter } from '@/lib/prisma-adapter'
import { LogicalDate } from '@/lib/logical-date'

const getCurrentUserId = () => 'user-1' // TODO: Replace with actual auth

export async function GET(request: NextRequest) {
  try {
    const userId = getCurrentUserId()
    const { searchParams } = new URL(request.url)
    
    const filters = {
      accountId: searchParams.get('accountId') ?? undefined,
      startDate: searchParams.get('startDate') 
        ? LogicalDate.fromString(searchParams.get('startDate')!)
        : undefined,
      endDate: searchParams.get('endDate') 
        ? LogicalDate.fromString(searchParams.get('endDate')!)
        : undefined,
      recurring: searchParams.get('recurring') ? searchParams.get('recurring') === 'true' : undefined,
    }

    const transactions = await dataAdapter.getTransactions(userId, filters)
    
    // Convert LogicalDate objects to calendar date strings (YYYY-MM-DD)
    const transactionsWithPlainDates = transactions.map(tx => ({
      ...tx,
      date: tx.date.toString(),
      ...(tx.recurrence?.endDate && {
        recurrence: {
          ...tx.recurrence,
          endDate: tx.recurrence.endDate.toString(),
        },
      }),
    }))
    
    return NextResponse.json(transactionsWithPlainDates)
  } catch (error) {
    console.error('Error fetching transactions:', error)
    return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = getCurrentUserId()
    const body = await request.json()

    // Ensure amount is a number (not a string)
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

    const transaction = await dataAdapter.createTransaction(userId, body)
    
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
    
    return NextResponse.json(response, { status: 201 })
  } catch (error) {
    console.error('Error creating transaction:', error)
    return NextResponse.json({ error: 'Failed to create transaction' }, { status: 500 })
  }
}
