import { beforeAll } from 'vitest'

beforeAll(() => {
  // Set in-memory database URL for tests
  process.env.DATABASE_URL = 'file::memory:?cache=shared'
})
