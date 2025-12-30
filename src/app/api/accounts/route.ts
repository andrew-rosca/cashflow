import { NextRequest, NextResponse } from 'next/server'
import { dataAdapter } from '@/lib/prisma-adapter'
import { LogicalDate } from '@/lib/logical-date'
import { getCurrentUserId } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const userId = await getCurrentUserId()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const accounts = await dataAdapter.getAccounts(userId)
    
    // Convert LogicalDate objects to calendar date strings (YYYY-MM-DD)
    const accountsWithPlainDates = accounts.map(acc => ({
      ...acc,
      balanceAsOf: acc.balanceAsOf.toString(),
    }))
    
    return NextResponse.json(accountsWithPlainDates)
  } catch (error) {
    console.error('Error fetching accounts:', error)
    return NextResponse.json({ error: 'Failed to fetch accounts' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
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

    const account = await dataAdapter.createAccount(userId, body)
    
    // Convert response back to calendar date string (YYYY-MM-DD)
    const response = {
      ...account,
      balanceAsOf: account.balanceAsOf.toString(),
    }
    
    return NextResponse.json(response, { status: 201 })
  } catch (error) {
    console.error('Error creating account:', error)
    return NextResponse.json({ error: 'Failed to create account' }, { status: 500 })
  }
}
