import { beforeAll, afterAll } from 'vitest'
import '@testing-library/jest-dom'
import { PrismaClient } from '@prisma/client'
import { execSync } from 'child_process'
import { tmpdir } from 'os'
import { join } from 'path'
import { unlinkSync, existsSync } from 'fs'

// Use a temporary file database for tests (ephemeral - gets deleted after tests)
// This allows proper schema initialization unlike in-memory databases
// Each test run gets a unique database file that is cleaned up afterwards
const testDbPath = join(tmpdir(), `cashflow-test-${Date.now()}-${Math.random().toString(36).substring(7)}.db`)
process.env.DATABASE_URL = `file:${testDbPath}`

let schemaInitialized = false

beforeAll(async () => {
  // Push schema to the test database using Prisma CLI
  // This must happen before any PrismaClient is instantiated
  try {
    execSync(`npx prisma db push --skip-generate --accept-data-loss --force-reset`, {
      env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
      stdio: 'pipe', // Suppress output but allow errors
      cwd: process.cwd(),
    })
    schemaInitialized = true
  } catch (error: any) {
    // If db push fails, log the error but continue
    // Tests will fail with clear error messages if schema isn't initialized
    console.error('Failed to initialize test database schema:', error?.message || error)
    schemaInitialized = false
  }
})

afterAll(async () => {
  // Clean up: delete test database file
  // This ensures test data doesn't persist and pollute the system
  try {
    if (existsSync(testDbPath)) {
      unlinkSync(testDbPath)
    }
  } catch (error) {
    // Ignore errors - file might be locked or already deleted
    // This is not critical as the file is in tmpdir and will be cleaned by OS
  }
})
