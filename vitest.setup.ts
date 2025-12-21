import { beforeAll } from 'vitest'
import '@testing-library/jest-dom'

beforeAll(() => {
  // Set in-memory database URL for tests
  process.env.DATABASE_URL = 'file::memory:?cache=shared'
})
