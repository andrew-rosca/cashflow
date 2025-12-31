import { beforeAll, afterAll } from 'vitest'
import '@testing-library/jest-dom'
import { execSync } from 'child_process'
import { tmpdir } from 'os'
import { join } from 'path'
import { unlinkSync, existsSync } from 'fs'

// CRITICAL: Run schema switching and Prisma generation synchronously at module load time
// This must happen BEFORE any test files are imported, because module imports happen
// synchronously and test files may import modules that use PrismaClient.
// We use a default SQLite URL for schema switching - actual test databases are created in beforeAll
const defaultTestDbUrl = 'file:./prisma/test-schema.db'

try {
  // Switch schema to SQLite (tests use SQLite)
  execSync(`node scripts/switch-schema.js`, {
    env: { ...process.env, DATABASE_URL: defaultTestDbUrl },
    stdio: 'pipe', // Suppress output but allow errors
    cwd: process.cwd(),
  })
  
  // Generate Prisma Client with the switched schema
  // This must happen before any module imports PrismaClient
  execSync(`npx prisma generate`, {
    env: { ...process.env, DATABASE_URL: defaultTestDbUrl },
    stdio: 'pipe', // Suppress output but allow errors
    cwd: process.cwd(),
  })
} catch (error: any) {
  // If generation fails, log the error - tests will fail with clear messages
  console.error('Failed to generate Prisma Client:', error?.message || error)
}

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
  // Prisma Client is already generated above, so we just need to push the schema
  try {
    // Now push the schema to the specific test database
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
