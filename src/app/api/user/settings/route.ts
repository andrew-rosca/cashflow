import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUserId } from '@/lib/auth'
import { prisma } from '@/lib/db'

type UserPreferences = {
  formatNumbersWithoutDecimals?: boolean
  [key: string]: any // Allow for future preferences
}

export async function GET(request: NextRequest) {
  try {
    const userId = await getCurrentUserId()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Parse preferences JSON (SQLite stores as string, PostgreSQL as JSON)
    // If preferences is null/undefined, return defaults
    let preferences: UserPreferences = {}
    const prefs = (user as any).preferences
    if (prefs) {
      try {
        if (typeof prefs === 'string') {
          preferences = JSON.parse(prefs)
        } else {
          preferences = prefs as UserPreferences
        }
      } catch (error) {
        // If JSON parsing fails, use empty preferences (will use defaults)
        console.error('Error parsing user preferences:', error)
        preferences = {}
      }
    }

    return NextResponse.json({
      formatNumbersWithoutDecimals: preferences.formatNumbersWithoutDecimals ?? false,
    })
  } catch (error) {
    console.error('Error fetching user settings:', error)
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const userId = await getCurrentUserId()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { formatNumbersWithoutDecimals } = body

    if (typeof formatNumbersWithoutDecimals !== 'boolean') {
      return NextResponse.json({ error: 'Invalid formatNumbersWithoutDecimals value' }, { status: 400 })
    }

    // Get existing preferences
    const user = await prisma.user.findUnique({
      where: { id: userId },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Parse existing preferences
    let preferences: UserPreferences = {}
    const prefs = (user as any).preferences
    if (prefs) {
      if (typeof prefs === 'string') {
        preferences = JSON.parse(prefs)
      } else {
        preferences = prefs as UserPreferences
      }
    }

    // Update the specific preference
    preferences.formatNumbersWithoutDecimals = formatNumbersWithoutDecimals

    // Save updated preferences
    // Prisma handles JSON differently: PostgreSQL Json type accepts objects,
    // SQLite String type needs strings. We'll stringify for SQLite compatibility
    // and Prisma will handle it correctly for PostgreSQL based on the schema
    const dbUrl = process.env.DATABASE_URL || ''
    const isPostgres = dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://')
    
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        preferences: isPostgres ? (preferences as any) : JSON.stringify(preferences),
      } as any, // Type assertion needed because Prisma types may not be fully updated
    })

    // Parse and return the updated preference
    let updatedPreferences: UserPreferences = {}
    const updatedPrefs = (updatedUser as any).preferences
    if (updatedPrefs) {
      if (typeof updatedPrefs === 'string') {
        updatedPreferences = JSON.parse(updatedPrefs)
      } else {
        updatedPreferences = updatedPrefs as UserPreferences
      }
    }

    return NextResponse.json({
      formatNumbersWithoutDecimals: updatedPreferences.formatNumbersWithoutDecimals ?? false,
    })
  } catch (error) {
    console.error('Error updating user settings:', error)
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 })
  }
}
