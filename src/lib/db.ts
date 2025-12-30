import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  databaseUrl: string | undefined
}

/**
 * Get or create Prisma client instance
 * In development/test, we recreate the client if DATABASE_URL changes
 * to support test servers with different databases
 */
function getPrismaClient(): PrismaClient {
  const currentDatabaseUrl = process.env.DATABASE_URL
  
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
      globalForPrisma.prisma = new PrismaClient()
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
      globalForPrisma.prisma = new PrismaClient()
      globalForPrisma.databaseUrl = currentDatabaseUrl
    }
    
    return globalForPrisma.prisma
  }
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
