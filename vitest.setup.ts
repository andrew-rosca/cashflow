import { beforeAll, afterAll } from 'vitest'
import '@testing-library/jest-dom'
import { execSync } from 'child_process'
import { tmpdir } from 'os'
import { join } from 'path'
import { unlinkSync, existsSync } from 'fs'

// Use a temporary file database for tests (ephemeral - gets deleted after tests)
// This allows proper schema initialization unlike in-memory databases
// Each test run gets a unique database file that is cleaned up afterwards
// IMPORTANT: Only set DATABASE_URL inside beforeAll to avoid affecting dev server
let testDbPath: string | null = null
let originalDatabaseUrl: string | undefined

beforeAll(async () => {
  // Save the original DATABASE_URL if it exists (shouldn't be needed in tests, but just in case)
  originalDatabaseUrl = process.env.DATABASE_URL
  
  // Create a unique test database path
  testDbPath = join(tmpdir(), `cashflow-test-${Date.now()}-${Math.random().toString(36).substring(7)}.db`)
  
  // Set DATABASE_URL for tests only (SQLite for tests)
  process.env.DATABASE_URL = `file:${testDbPath}`
  
  // Push schema to the test database using Prisma CLI
  // This must happen before any PrismaClient is instantiated
  // First, switch to the correct schema (SQLite for tests)
  // Then generate Prisma Client, then push the schema
  try {
    // Switch schema to SQLite (tests use SQLite)
    execSync(`node scripts/switch-schema.js`, {
      env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
      stdio: 'pipe', // Suppress output but allow errors
      cwd: process.cwd(),
    })
    
    // Generate Prisma Client with the switched schema
    execSync(`npx prisma generate`, {
      env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
      stdio: 'pipe', // Suppress output but allow errors
      cwd: process.cwd(),
    })
    
    // Now push the schema
    execSync(`npx prisma db push --skip-generate --accept-data-loss --force-reset`, {
      env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
      stdio: 'pipe', // Suppress output but allow errors
      cwd: process.cwd(),
    })
  } catch (error: any) {
    // If db push fails, log the error but continue
    // Tests will fail with clear error messages if schema isn't initialized
    console.error('Failed to initialize test database schema:', error?.message || error)
  }
})

afterAll(async () => {
  // Restore original DATABASE_URL if it existed
  if (originalDatabaseUrl !== undefined) {
    process.env.DATABASE_URL = originalDatabaseUrl
  } else {
    delete process.env.DATABASE_URL
  }
  
  // Clean up: delete test database file
  // This ensures test data doesn't persist and pollute the system
  if (testDbPath) {
    try {
      if (existsSync(testDbPath)) {
        unlinkSync(testDbPath)
      }
    } catch (error) {
      // Ignore errors - file might be locked or already deleted
      // This is not critical as the file is in tmpdir and will be cleaned by OS
    }
  }
})
