import { NextRequest, NextResponse } from 'next/server'
import { dataAdapter } from '@/lib/prisma-adapter'

// Stub implementation - auth will be added later
const getCurrentUserId = () => 'user-1' // TODO: Replace with actual auth

export async function GET(request: NextRequest) {
  try {
    const userId = getCurrentUserId()
    const accounts = await dataAdapter.getAccounts(userId)
    return NextResponse.json(accounts)
  } catch (error) {
    console.error('Error fetching accounts:', error)
    return NextResponse.json({ error: 'Failed to fetch accounts' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = getCurrentUserId()
    const body = await request.json()

    // Parse balanceAsOf as local date to avoid timezone shifts
    if (body.balanceAsOf) {
      const dateStr = typeof body.balanceAsOf === 'string' ? body.balanceAsOf : body.balanceAsOf.toISOString()
      // Extract date part and create at local midnight
      const dateOnly = dateStr.split('T')[0]
      body.balanceAsOf = new Date(dateOnly + 'T00:00:00')
    }

    const account = await dataAdapter.createAccount(userId, body)
    return NextResponse.json(account, { status: 201 })
  } catch (error) {
    console.error('Error creating account:', error)
    return NextResponse.json({ error: 'Failed to create account' }, { status: 500 })
  }
}
