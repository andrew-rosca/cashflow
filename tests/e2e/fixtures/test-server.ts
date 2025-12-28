import { execSync } from 'child_process'
import { tmpdir } from 'os'
import { join } from 'path'
import { existsSync, unlinkSync } from 'fs'
import { spawn, ChildProcess } from 'child_process'

/**
 * Test Server Fixture
 * 
 * Manages an ephemeral database and Next.js server for E2E tests.
 * Each test run gets a unique SQLite database file that is cleaned up afterwards.
 */

export interface TestServer {
  baseUrl: string
  dbPath: string
  databaseUrl: string
  stop: () => Promise<void>
}

let testServer: TestServer | null = null
let serverProcess: ChildProcess | null = null

/**
 * Start the test server with an ephemeral database
 * Each call creates a fresh database - no singleton pattern
 */
export async function startTestServer(port: number = 3000): Promise<TestServer> {
  // Always create a fresh database for each test
  // Create a unique test database path (include process ID for uniqueness)
  const dbPath = join(
    tmpdir(),
    `cashflow-e2e-test-${process.pid}-${Date.now()}-${Math.random().toString(36).substring(7)}.db`
  )

  // Set DATABASE_URL for this test run
  const databaseUrl = `file:${dbPath}`
  const originalDatabaseUrl = process.env.DATABASE_URL

  try {
    // Push schema to the test database using Prisma CLI
    // This must happen before any PrismaClient is instantiated
    execSync(`npx prisma db push --skip-generate --accept-data-loss --force-reset`, {
      env: { ...process.env, DATABASE_URL: databaseUrl },
      stdio: 'pipe',
      cwd: process.cwd(),
    })
    
    // Create the required user-1 that the API expects
    // This ensures the database is blank (no accounts/transactions) but has the required user
    const { PrismaClient } = require('@prisma/client')
    const prisma = new PrismaClient({
      datasources: {
        db: {
          url: databaseUrl,
        },
      },
    })
    
    // Enable WAL mode for better concurrency
    // This allows multiple readers while a write is in progress
    await prisma.$queryRawUnsafe('PRAGMA journal_mode=WAL')
    await prisma.$queryRawUnsafe('PRAGMA synchronous=NORMAL')
    
    // Clear all existing data first (in case database file was reused)
    await prisma.recurrence.deleteMany({})
    await prisma.transaction.deleteMany({})
    await prisma.cashFlowAccount.deleteMany({})
    await prisma.user.deleteMany({})
    
    // Create the required user-1 that the API expects (blank database with just this user)
    await prisma.user.upsert({
      where: { id: 'user-1' },
      update: {},
      create: {
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
      },
    })
    
    // Verify database is blank (only user-1 should exist)
    const accountCount = await prisma.cashFlowAccount.count()
    const transactionCount = await prisma.transaction.count()
    const recurrenceCount = await prisma.recurrence.count()
    
    if (accountCount > 0 || transactionCount > 0 || recurrenceCount > 0) {
      throw new Error(
        `Database is not blank! Found ${accountCount} accounts, ${transactionCount} transactions, and ${recurrenceCount} recurrences`
      )
    }
    
    await prisma.$disconnect()
  } catch (error: any) {
    throw new Error(`Failed to initialize test database schema: ${error?.message || error}`)
  }

  // Kill any existing server on this port before starting
  try {
    execSync(`lsof -ti:${port} | xargs kill -9 2>/dev/null || true`, { stdio: 'ignore' })
    // Wait a moment for port to be released
    await new Promise(resolve => setTimeout(resolve, 500))
  } catch {
    // No process on this port, that's fine
  }

  // Start Next.js server with test database
  const baseUrl = `http://localhost:${port}`
  
  serverProcess = spawn('npm', ['run', 'dev'], {
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
      PORT: port.toString(),
      NODE_ENV: 'test',
    },
    stdio: 'pipe',
    shell: true,
  })

  // Wait for server to be ready
  await waitForServer(baseUrl, 30000)

  const server: TestServer = {
    baseUrl,
    dbPath,
    databaseUrl,
    stop: async () => {
      await stopTestServer(originalDatabaseUrl, dbPath, serverProcess)
    },
  }

  // Store for cleanup reference
  testServer = server
  return server
}

/**
 * Stop the test server and clean up the database
 */
export async function stopTestServer(
  originalDatabaseUrl?: string,
  dbPath?: string,
  processToKill?: ChildProcess | null
): Promise<void> {
  // Kill the server process
  const proc = processToKill || serverProcess
  if (proc) {
    proc.kill('SIGTERM')
    if (processToKill === undefined) {
      serverProcess = null
    }
  }

  // Clean up database file
  const pathToClean = dbPath || testServer?.dbPath
  if (pathToClean) {
    try {
      // Wait a bit for the database to be released
      await new Promise(resolve => setTimeout(resolve, 500))
      if (existsSync(pathToClean)) {
        unlinkSync(pathToClean)
      }
    } catch (error) {
      // Ignore errors - file might be locked or already deleted
      console.warn(`Failed to delete test database: ${pathToClean}`, error)
    }
  }

  // Restore original DATABASE_URL if it existed
  if (originalDatabaseUrl !== undefined) {
    process.env.DATABASE_URL = originalDatabaseUrl
  } else {
    delete process.env.DATABASE_URL
  }

  // Clear the singleton reference
  if (dbPath === undefined) {
    testServer = null
  }
}

/**
 * Wait for the server to be ready by polling the health endpoint
 */
async function waitForServer(url: string, timeout: number): Promise<void> {
  const startTime = Date.now()
  const maxAttempts = 60
  let attempts = 0

  while (Date.now() - startTime < timeout && attempts < maxAttempts) {
    try {
      const response = await fetch(url)
      if (response.ok) {
        return
      }
    } catch (error) {
      // Server not ready yet, continue waiting
    }

    await new Promise((resolve) => setTimeout(resolve, 500))
    attempts++
  }

  throw new Error(`Server did not become ready at ${url} within ${timeout}ms`)
}

/**
 * Get the current test server instance
 */
export function getTestServer(): TestServer | null {
  return testServer
}

