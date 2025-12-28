import { test as base } from '@playwright/test'
import { startTestServer, stopTestServer, TestServer } from './test-server'
import { PrismaClient } from '@prisma/client'

/**
 * Playwright Test Fixtures
 * 
 * Extends Playwright's base test with custom fixtures for:
 * - Test server with ephemeral database
 * - Prisma client for test data setup
 */

type TestFixtures = {
  testServer: TestServer
  prisma: PrismaClient
}

export const test = base.extend<TestFixtures>({
  // Test server fixture - starts before each test suite
  testServer: async ({ }, use, testInfo) => {
    // Use a unique port for each worker to allow parallel test execution
    // Base port 3000 + worker index (0, 1, 2, ...)
    const port = 3000 + testInfo.parallelIndex
    const server = await startTestServer(port)
    try {
      await use(server)
    } finally {
      await stopTestServer()
    }
  },

  // Prisma client fixture - provides database access for test setup
  prisma: async ({ testServer }, use) => {
    // Create Prisma client with test database URL
    // Note: The DATABASE_URL env var is already set by testServer.start()
    const prisma = new PrismaClient()

    try {
      await use(prisma)
    } finally {
      await prisma.$disconnect()
    }
  },
})

export { expect } from '@playwright/test'

