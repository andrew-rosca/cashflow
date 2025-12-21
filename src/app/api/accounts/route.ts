import { NextRequest, NextResponse } from 'next/server'
import { dataAdapter } from '@/lib/prisma-adapter'

// Stub implementation - auth will be added later
const getCurrentUserId = () => 'user-1' // TODO: Replace with actual auth

export async function GET(request: NextRequest) {
  try {
    const userId = getCurrentUserId()
    const accounts = await dataAdapter.getAccounts(userId)
    // Log dates to debug
    accounts.forEach(acc => {
      if (acc.balanceAsOf) {
        const dateStr = typeof acc.balanceAsOf === 'string' ? acc.balanceAsOf : acc.balanceAsOf.toISOString()
        console.log('[API GET] Account', acc.name, 'balanceAsOf:', dateStr, 'year from string:', dateStr.split('T')[0].split('-')[0])
      }
    })
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

    // Parse balanceAsOf as UTC date to avoid timezone shifts
    if (body.balanceAsOf) {
      const dateStr = typeof body.balanceAsOf === 'string' ? body.balanceAsOf : body.balanceAsOf.toISOString()
      // Extract date part and create at UTC midnight to avoid timezone conversion issues
      const dateOnly = dateStr.split('T')[0]
      const [year, month, day] = dateOnly.split('-').map(Number)
      body.balanceAsOf = new Date(Date.UTC(year, month - 1, day))
    }

    const account = await dataAdapter.createAccount(userId, body)
    return NextResponse.json(account, { status: 201 })
  } catch (error) {
    console.error('Error creating account:', error)
    return NextResponse.json({ error: 'Failed to create account' }, { status: 500 })
  }
}
