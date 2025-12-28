import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { PrismaDataAdapter } from '@/lib/prisma-adapter'
import { LogicalDate } from '@/lib/logical-date'
import { startTestServer, stopTestServer, TestServer } from '../e2e/fixtures/test-server'

let prisma: PrismaClient
let adapter: PrismaDataAdapter
let testServer: TestServer
const TEST_USER_ID = 'user-1' // API uses 'user-1' as the current user

describe('Bulk Transactions API Tests', () => {
  let checkingAccountId: string
  let savingsAccountId: string
  let incomeAccountId: string
  let expensesAccountId: string

  beforeAll(async () => {
    // Start test server with ephemeral database
    testServer = await startTestServer(3001)
    
    // Create PrismaClient using the test server's database URL
    // The test server already creates user-1, so we can use it directly
    prisma = new PrismaClient({
      datasources: {
        db: {
          url: testServer.databaseUrl,
        },
      },
    })
    adapter = new PrismaDataAdapter(prisma)
    
    // Create test accounts
    const checking = await adapter.createAccount(TEST_USER_ID, {
      name: 'Main Checking',
      initialBalance: 1000,
      balanceAsOf: LogicalDate.fromString('2025-01-01'),
    })
    const savings = await adapter.createAccount(TEST_USER_ID, {
      name: 'Savings',
      initialBalance: 5000,
      balanceAsOf: LogicalDate.fromString('2025-01-01'),
    })
    const income = await adapter.createAccount(TEST_USER_ID, {
      name: 'Income',
      initialBalance: 0,
      balanceAsOf: LogicalDate.fromString('2025-01-01'),
    })
    const expenses = await adapter.createAccount(TEST_USER_ID, {
      name: 'Expenses',
      initialBalance: 0,
      balanceAsOf: LogicalDate.fromString('2025-01-01'),
    })

    checkingAccountId = checking.id
    savingsAccountId = savings.id
    incomeAccountId = income.id
    expensesAccountId = expenses.id
  })

  afterAll(async () => {
    await stopTestServer()
    await prisma.$disconnect()
  })

  beforeEach(async () => {
    // Clean up transactions before each test
    await prisma.transaction.deleteMany({ where: { userId: TEST_USER_ID } })
  })

  describe('GET /api/transactions/bulk - Export transactions', () => {
    it('should export empty transactions as TSV with header only', async () => {
      const response = await fetch(`${testServer.baseUrl}/api/transactions/bulk`)
      expect(response.status).toBe(200)
      expect(response.headers.get('Content-Type')).toContain('text/tab-separated-values')
      
      const tsv = await response.text()
      const lines = tsv.split('\n').filter(line => line.trim())
      
      expect(lines.length).toBe(1) // Only header
      expect(lines[0]).toBe('ID\tType\tAccount ID\tAmount\tDate\tDescription\tFrequency\tInterval\tDay of Week\tDay of Month\tEnd Date\tOccurrences')
    })

    it('should export one-time transactions as TSV', async () => {
      // Create a one-time transaction
      await adapter.createTransaction(TEST_USER_ID, {
        fromAccountId: checkingAccountId,
        toAccountId: expensesAccountId,
        amount: -50,
        date: LogicalDate.fromString('2025-01-15'),
        description: 'Groceries',
        settlementDays: 0,
      })

      const response = await fetch(`${testServer.baseUrl}/api/transactions/bulk`)
      expect(response.status).toBe(200)
      
      const tsv = await response.text()
      const lines = tsv.split('\n').filter(line => line.trim())
      
      expect(lines.length).toBe(2) // Header + 1 transaction
      expect(lines[0]).toBe('ID\tType\tAccount ID\tAmount\tDate\tDescription\tFrequency\tInterval\tDay of Week\tDay of Month\tEnd Date\tOccurrences')
      
      const fields = lines[1].split('\t')
      expect(fields[0]).toBeDefined() // Transaction ID
      expect(fields[1]).toBe('one-time')
      expect(fields[2]).toBe(checkingAccountId) // Account ID
      expect(fields[3]).toBe('-50')
      expect(fields[4]).toBe('2025-01-15')
      expect(fields[5]).toBe('Groceries')
      // Recurrence fields should be empty for one-time
      expect(fields[6]).toBe('')
      expect(fields[7]).toBe('')
      expect(fields[8]).toBe('')
      expect(fields[9]).toBe('')
      expect(fields[10]).toBe('')
      expect(fields[11]).toBe('')
    })

    it('should export recurring transactions as TSV', async () => {
      // Create a recurring transaction
      await adapter.createTransaction(TEST_USER_ID, {
        fromAccountId: incomeAccountId,
        toAccountId: checkingAccountId,
        amount: 2800,
        date: LogicalDate.fromString('2025-01-20'),
        description: 'Paycheck',
        recurrence: {
          frequency: 'weekly',
          interval: 2,
        },
      })

      const response = await fetch(`${testServer.baseUrl}/api/transactions/bulk`)
      expect(response.status).toBe(200)
      
      const tsv = await response.text()
      const lines = tsv.split('\n').filter(line => line.trim())
      
      expect(lines.length).toBe(2) // Header + 1 transaction
      const fields = lines[1].split('\t')
      expect(fields[0]).toBeDefined() // Transaction ID
      expect(fields[1]).toBe('recurring')
      expect(fields[2]).toBe(incomeAccountId) // Account ID
      expect(fields[3]).toBe('2800')
      expect(fields[4]).toBe('2025-01-20')
      expect(fields[5]).toBe('Paycheck')
      expect(fields[6]).toBe('weekly')
      expect(fields[7]).toBe('2')
      expect(fields[8]).toBe('') // No day of week
      expect(fields[9]).toBe('') // No day of month
      expect(fields[10]).toBe('-1') // No end date
      expect(fields[11]).toBe('-1') // No occurrences
    })

    it('should export recurring transaction with all recurrence fields', async () => {
      // Create a recurring transaction with all fields
      await adapter.createTransaction(TEST_USER_ID, {
        fromAccountId: checkingAccountId,
        toAccountId: expensesAccountId,
        amount: -1800,
        date: LogicalDate.fromString('2025-02-01'),
        description: 'Rent',
        recurrence: {
          frequency: 'monthly',
          interval: 1,
          dayOfMonth: 1,
          endDate: LogicalDate.fromString('2025-12-31'),
        },
      })

      const response = await fetch(`${testServer.baseUrl}/api/transactions/bulk`)
      expect(response.status).toBe(200)
      
      const tsv = await response.text()
      const lines = tsv.split('\n').filter(line => line.trim())
      
      const fields = lines[1].split('\t')
      expect(fields[0]).toBeDefined() // Transaction ID
      expect(fields[1]).toBe('recurring')
      expect(fields[6]).toBe('monthly')
      expect(fields[7]).toBe('1')
      expect(fields[8]).toBe('') // No day of week
      expect(fields[9]).toBe('1') // Day of month
      expect(fields[10]).toBe('2025-12-31') // End date
      expect(fields[11]).toBe('') // No occurrences
    })

    it('should export multiple transactions', async () => {
      // Create multiple transactions
      await adapter.createTransaction(TEST_USER_ID, {
        fromAccountId: checkingAccountId,
        toAccountId: expensesAccountId,
        amount: -50,
        date: LogicalDate.fromString('2025-01-15'),
        description: 'Groceries',
      })
      await adapter.createTransaction(TEST_USER_ID, {
        fromAccountId: incomeAccountId,
        toAccountId: checkingAccountId,
        amount: 2800,
        date: LogicalDate.fromString('2025-01-20'),
        description: 'Paycheck',
        recurrence: {
          frequency: 'weekly',
          interval: 2,
        },
      })

      const response = await fetch(`${testServer.baseUrl}/api/transactions/bulk`)
      expect(response.status).toBe(200)
      
      const tsv = await response.text()
      const lines = tsv.split('\n').filter(line => line.trim())
      
      expect(lines.length).toBe(3) // Header + 2 transactions
    })
  })

  describe('POST /api/transactions/bulk - Import transactions', () => {
    it('should reject empty TSV', async () => {
      const response = await fetch(`${testServer.baseUrl}/api/transactions/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/tab-separated-values' },
        body: '',
      })
      
      expect(response.status).toBe(400)
      const json = await response.json()
      expect(json.error).toBe('Empty TSV data')
    })

    it('should reject TSV with no data rows', async () => {
      const response = await fetch(`${testServer.baseUrl}/api/transactions/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/tab-separated-values' },
        body: 'ID\tType\tAccount ID\tAmount\tDate\tDescription\tFrequency\tInterval\tDay of Week\tDay of Month\tEnd Date\tOccurrences',
      })
      
      expect(response.status).toBe(400)
      const json = await response.json()
      expect(json.error).toBe('Validation errors')
      expect(json.errors).toContainEqual(expect.stringContaining('No data rows'))
    })

    it('should reject TSV with invalid header', async () => {
      const response = await fetch(`${testServer.baseUrl}/api/transactions/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/tab-separated-values' },
        body: 'Invalid\tHeader',
      })
      
      expect(response.status).toBe(400)
      const json = await response.json()
      expect(json.error).toBe('Validation errors')
      expect(json.errors).toContainEqual(expect.stringContaining('Invalid header'))
    })

    it('should import one-time transaction', async () => {
      const tsv = `ID\tType\tAccount ID\tAmount\tDate\tDescription\tFrequency\tInterval\tDay of Week\tDay of Month\tEnd Date\tOccurrences
\tone-time\t${checkingAccountId}\t-50.00\t2025-01-15\tGroceries\t0\t\t\t\t\t\t`

      const response = await fetch(`${testServer.baseUrl}/api/transactions/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/tab-separated-values' },
        body: tsv,
      })
      
      if (response.status !== 201) {
        const errorJson = await response.json()
        console.error('Import failed:', JSON.stringify(errorJson, null, 2))
      }
      expect(response.status).toBe(201)
      const json = await response.json()
      expect(json.message).toContain('Successfully imported 1 transaction')
      expect(json.transactions).toHaveLength(1)
      expect(json.transactions[0].amount).toBe(-50)
      expect(json.transactions[0].description).toBe('Groceries')
      
      // Verify transaction was created
      const transactions = await adapter.getTransactions(TEST_USER_ID)
      expect(transactions).toHaveLength(1)
      expect(transactions[0].amount).toBe(-50)
      expect(transactions[0].description).toBe('Groceries')
      expect(transactions[0].recurrence).toBeUndefined()
    })

    it('should import recurring transaction', async () => {
      const tsv = `ID\tType\tAccount ID\tAmount\tDate\tDescription\tFrequency\tInterval\tDay of Week\tDay of Month\tEnd Date\tOccurrences
\trecurring\t${incomeAccountId}\t2800.00\t2025-01-20\tPaycheck\tweekly\t2\t\t\t-1\t-1\t`

      const response = await fetch(`${testServer.baseUrl}/api/transactions/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/tab-separated-values' },
        body: tsv,
      })
      
      expect(response.status).toBe(201)
      const json = await response.json()
      expect(json.message).toContain('Successfully imported 1 transaction')
      expect(json.transactions).toHaveLength(1)
      expect(json.transactions[0].amount).toBe(2800)
      expect(json.transactions[0].recurrence).toBeDefined()
      expect(json.transactions[0].recurrence.frequency).toBe('weekly')
      expect(json.transactions[0].recurrence.interval).toBe(2)
      
      // Verify transaction was created
      const transactions = await adapter.getTransactions(TEST_USER_ID)
      expect(transactions).toHaveLength(1)
      expect(transactions[0].recurrence?.frequency).toBe('weekly')
      expect(transactions[0].recurrence?.interval).toBe(2)
    })

    it('should import recurring transaction with all fields', async () => {
      const tsv = `ID\tType\tAccount ID\tAmount\tDate\tDescription\tFrequency\tInterval\tDay of Week\tDay of Month\tEnd Date\tOccurrences
\trecurring\t${checkingAccountId}\t-1800.00\t2025-02-01\tRent\tmonthly\t1\t\t1\t2025-12-31\t\t`

      const response = await fetch(`${testServer.baseUrl}/api/transactions/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/tab-separated-values' },
        body: tsv,
      })
      
      expect(response.status).toBe(201)
      const json = await response.json()
      expect(json.transactions[0].recurrence).toBeDefined()
      expect(json.transactions[0].recurrence.frequency).toBe('monthly')
      expect(json.transactions[0].recurrence.interval).toBe(1)
      expect(json.transactions[0].recurrence.dayOfMonth).toBe(1)
      expect(json.transactions[0].recurrence.endDate).toBe('2025-12-31')
    })

    it('should import multiple transactions', async () => {
      const tsv = `ID\tType\tAccount ID\tAmount\tDate\tDescription\tFrequency\tInterval\tDay of Week\tDay of Month\tEnd Date\tOccurrences
\tone-time\t${checkingAccountId}\t-50.00\t2025-01-15\tGroceries\t\t\t\t\t\t
\trecurring\t${incomeAccountId}\t2800.00\t2025-01-20\tPaycheck\tweekly\t2\t\t\t-1\t-1\t
\trecurring\t${checkingAccountId}\t-1800.00\t2025-02-01\tRent\tmonthly\t1\t\t1\t2025-12-31\t\t`

      const response = await fetch(`${testServer.baseUrl}/api/transactions/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/tab-separated-values' },
        body: tsv,
      })
      
      expect(response.status).toBe(201)
      const json = await response.json()
      expect(json.message).toContain('Successfully imported 3 transaction')
      expect(json.transactions).toHaveLength(3)
      
      // Verify all transactions were created
      const transactions = await adapter.getTransactions(TEST_USER_ID)
      expect(transactions).toHaveLength(3)
    })

    it('should reject transaction with invalid account name', async () => {
      const tsv = `ID\tType\tAccount ID\tAmount\tDate\tDescription\tFrequency\tInterval\tDay of Week\tDay of Month\tEnd Date\tOccurrences
\tone-time\tinvalid-account-id\t-50.00\t2025-01-15\tGroceries\t0\t\t\t\t\t\t`

      const response = await fetch(`${testServer.baseUrl}/api/transactions/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/tab-separated-values' },
        body: tsv,
      })
      
      expect(response.status).toBe(400)
      const json = await response.json()
      expect(json.error).toBe('Validation errors')
      expect(json.errors).toContainEqual(expect.stringContaining('Account ID "invalid-account-id" not found'))
    })

    it('should reject transaction with invalid type', async () => {
      const tsv = `ID\tType\tAccount ID\tAmount\tDate\tDescription\tFrequency\tInterval\tDay of Week\tDay of Month\tEnd Date\tOccurrences
\tinvalid-type\t${checkingAccountId}\t-50.00\t2025-01-15\tGroceries\t0\t\t\t\t\t\t`

      const response = await fetch(`${testServer.baseUrl}/api/transactions/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/tab-separated-values' },
        body: tsv,
      })
      
      expect(response.status).toBe(400)
      const json = await response.json()
      expect(json.error).toBe('Validation errors')
      expect(json.errors).toContainEqual(expect.stringContaining('Invalid type'))
    })

    it('should reject transaction with invalid date', async () => {
      const tsv = `ID\tType\tAccount ID\tAmount\tDate\tDescription\tFrequency\tInterval\tDay of Week\tDay of Month\tEnd Date\tOccurrences
\tone-time\t${checkingAccountId}\t-50.00\tinvalid-date\tGroceries\t0\t\t\t\t\t\t`

      const response = await fetch(`${testServer.baseUrl}/api/transactions/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/tab-separated-values' },
        body: tsv,
      })
      
      expect(response.status).toBe(400)
      const json = await response.json()
      expect(json.error).toBe('Validation errors')
      expect(json.errors).toContainEqual(expect.stringContaining('Invalid date'))
    })

    it('should reject recurring transaction with invalid frequency', async () => {
      const tsv = `ID\tType\tAccount ID\tAmount\tDate\tDescription\tFrequency\tInterval\tDay of Week\tDay of Month\tEnd Date\tOccurrences
\trecurring\t${incomeAccountId}\t2800.00\t2025-01-20\tPaycheck\tinvalid-frequency\t2\t\t\t-1\t-1\t`

      const response = await fetch(`${testServer.baseUrl}/api/transactions/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/tab-separated-values' },
        body: tsv,
      })
      
      expect(response.status).toBe(400)
      const json = await response.json()
      expect(json.error).toBe('Validation errors')
      expect(json.errors).toContainEqual(expect.stringContaining('Invalid frequency'))
    })

    it('should handle round-trip export and import', async () => {
      // Create transactions
      const tx1 = await adapter.createTransaction(TEST_USER_ID, {
        fromAccountId: checkingAccountId,
        toAccountId: checkingAccountId,
        amount: -50,
        date: LogicalDate.fromString('2025-01-15'),
        description: 'Groceries',
      })
      const tx2 = await adapter.createTransaction(TEST_USER_ID, {
        fromAccountId: incomeAccountId,
        toAccountId: incomeAccountId,
        amount: 2800,
        date: LogicalDate.fromString('2025-01-20'),
        description: 'Paycheck',
        recurrence: {
          frequency: 'weekly',
          interval: 2,
        },
      })

      // Export
      const exportResponse = await fetch(`${testServer.baseUrl}/api/transactions/bulk`)
      const exportedTsv = await exportResponse.text()

      // Import without deleting (should update existing transactions by ID, not create duplicates)
      const importResponse = await fetch(`${testServer.baseUrl}/api/transactions/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/tab-separated-values' },
        body: exportedTsv,
      })
      expect(importResponse.status).toBe(201)
      const json = await importResponse.json()
      expect(json.transactions).toHaveLength(2)
      expect(json.updated).toHaveLength(2) // Should update existing transactions (by ID)
      expect(json.created).toHaveLength(0) // Should not create duplicates

      // Verify transactions match
      const transactions = await adapter.getTransactions(TEST_USER_ID)
      expect(transactions).toHaveLength(2)
      
      const oneTime = transactions.find(tx => !tx.recurrence)
      const recurring = transactions.find(tx => tx.recurrence)
      
      expect(oneTime).toBeDefined()
      expect(oneTime?.amount).toBe(-50)
      expect(oneTime?.description).toBe('Groceries')
      
      expect(recurring).toBeDefined()
      expect(recurring?.amount).toBe(2800)
      expect(recurring?.recurrence?.frequency).toBe('weekly')
      expect(recurring?.recurrence?.interval).toBe(2)
    })
  })
})

