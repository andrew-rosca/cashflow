import { NextRequest, NextResponse } from 'next/server'
import { dataAdapter } from '@/lib/prisma-adapter'

// Stub implementation - auth will be added later
const getCurrentUserId = () => 'user-1' // TODO: Replace with actual auth

export async function GET(request: NextRequest) {
  try {
    const userId = getCurrentUserId()
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') as 'tracked' | 'external' | null

    const accounts = await dataAdapter.getAccounts(userId, type ?? undefined)
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

    const account = await dataAdapter.createAccount(userId, body)
    return NextResponse.json(account, { status: 201 })
  } catch (error) {
    console.error('Error creating account:', error)
    return NextResponse.json({ error: 'Failed to create account' }, { status: 500 })
  }
}
