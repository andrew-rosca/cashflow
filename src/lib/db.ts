import { PrismaClient } from '@prisma/client'
import path from 'path'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  databaseUrl: string | undefined
}

function getEffectiveDatabaseUrl(): string {
  const raw = (process.env.DATABASE_URL || '').trim()

  // Postgres (production) URLs are passed through unchanged
  if (raw.startsWith('postgresql://') || raw.startsWith('postgres://')) return raw

  const normalizeSqliteFileUrl = (fileUrl: string): string => {
    // Prisma accepts SQLite URLs in the form file:... (relative or absolute).
    // In practice, the Prisma engine can fail to resolve relative file: URLs depending
    // on its working directory. Normalize to an absolute file:/... URL to be robust.
    const after = fileUrl.slice('file:'.length)
    const qIdx = after.indexOf('?')
    const p = qIdx === -1 ? after : after.slice(0, qIdx)
    const q = qIdx === -1 ? '' : after.slice(qIdx)

    // Already absolute
    if (p.startsWith('/')) return `file:${p}${q}`

    // Normalize relative paths (./, ../, or plain) to absolute
    const absPath = path.resolve(process.cwd(), p)
    return `file:${absPath}${q}`
  }

  // SQLite URLs must be file:... for Prisma
  if (raw.startsWith('file:')) {
    const effective = normalizeSqliteFileUrl(raw)
    process.env.DATABASE_URL = effective
    return effective
  }

  // Common misconfig: sqlite:... (Prisma expects file:)
  if (raw.startsWith('sqlite:')) {
    const rest = raw.slice('sqlite:'.length)
    const effective = normalizeSqliteFileUrl(`file:${rest}`)
    process.env.DATABASE_URL = effective
    return effective
  }

  // If DATABASE_URL is missing, default to the local dev DB checked into the repo.
  // (This keeps local dev + NextAuth working even if env vars are missing.)
  if (!raw) {
    const effective = normalizeSqliteFileUrl('file:./prisma/dev.db')
    process.env.DATABASE_URL = effective
    return effective
  }

  // If it's a plain path, convert to Prisma's file: URL format.
  if (raw.startsWith('/')) {
    const effective = normalizeSqliteFileUrl(`file:${raw}`) // absolute path
    process.env.DATABASE_URL = effective
    return effective
  }

  const withoutLeadingDot = raw.startsWith('./') ? raw.slice(2) : raw
  const effective = normalizeSqliteFileUrl(`file:./${withoutLeadingDot}`)
  process.env.DATABASE_URL = effective
  return effective
}

/**
 * Get or create Prisma client instance
 * In development/test, we recreate the client if DATABASE_URL changes
 * to support test servers with different databases
 */
function getPrismaClient(): PrismaClient {
  const currentDatabaseUrl = getEffectiveDatabaseUrl()
  
  // In test mode, don't use global cache - always check DATABASE_URL
  // This is critical for test servers that use different databases for each test
  const isTestMode = process.env.NODE_ENV === 'test'
  
  if (isTestMode) {
    // In test mode, always check if DATABASE_URL changed and recreate client
    // This ensures we never use a stale client from a previous test run
    if (globalForPrisma.prisma && globalForPrisma.databaseUrl !== currentDatabaseUrl) {
      // DATABASE_URL changed - disconnect old client immediately
      globalForPrisma.prisma.$disconnect().catch(() => {})
      globalForPrisma.prisma = undefined
      globalForPrisma.databaseUrl = undefined
    }
    
    // Always create new client if DATABASE_URL doesn't match or client doesn't exist
    // This is more aggressive but ensures correctness in test mode
    if (!globalForPrisma.prisma || globalForPrisma.databaseUrl !== currentDatabaseUrl) {
      if (globalForPrisma.prisma) {
        globalForPrisma.prisma.$disconnect().catch(() => {})
      }
      globalForPrisma.prisma = new PrismaClient({
        datasources: {
          db: { url: currentDatabaseUrl },
        },
      })
      globalForPrisma.databaseUrl = currentDatabaseUrl
    }
    
    return globalForPrisma.prisma
  } else {
    // In production/development, use caching for performance
    if (globalForPrisma.prisma && globalForPrisma.databaseUrl !== currentDatabaseUrl) {
      globalForPrisma.prisma.$disconnect().catch(() => {})
      globalForPrisma.prisma = undefined
      globalForPrisma.databaseUrl = undefined
    }
    
    if (!globalForPrisma.prisma) {
      globalForPrisma.prisma = new PrismaClient({
        datasources: {
          db: { url: currentDatabaseUrl },
        },
      })
      globalForPrisma.databaseUrl = currentDatabaseUrl
    }
    
    return globalForPrisma.prisma
  }
}

export function getDatabaseUrlForPrismaClient(): string {
  return getEffectiveDatabaseUrl()
}

// Export prisma as a Proxy that intercepts all property access
// This makes it behave like a PrismaClient but calls getPrismaClient() on each access
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getPrismaClient()
    const value = (client as any)[prop]
    if (typeof value === 'function') {
      return value.bind(client)
    }
    return value
  },
}) as PrismaClient

// Don't initialize globalForPrisma.prisma here - let it be created lazily via the Proxy
// This ensures DATABASE_URL is read at access time, not module load time
// The Proxy will call getPrismaClient() which will create and cache the client as needed
