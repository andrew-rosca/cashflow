import { describe, it, expect } from 'vitest'
import { LogicalDate } from '@/lib/logical-date'
import type { Transaction } from '@/lib/data-adapter'
import {
  serializeTransactionToTSV,
  serializeTransactionsToTSV,
  parseTSVRow,
  parseTSV,
  tsvRowToTransaction,
  TSV_HEADER,
} from '@/lib/tsv-transactions'

describe('TSV Transaction Utilities', () => {
  describe('serializeTransactionToTSV', () => {
    it('should serialize a one-time transaction', () => {
      const transaction: Transaction = {
        id: 'tx-1',
        userId: 'user-1',
        fromAccountId: 'acc-1',
        toAccountId: 'acc-1',
        amount: -50,
        date: LogicalDate.fromString('2025-01-15'),
        description: 'Groceries',
        settlementDays: 0,
      }
      
      const result = serializeTransactionToTSV(transaction)
      const fields = result.split('\t')
      
      expect(fields[0]).toBe('tx-1') // Transaction ID
      expect(fields[1]).toBe('one-time')
      expect(fields[2]).toBe('acc-1') // Account ID
      expect(fields[3]).toBe('-50')
      expect(fields[4]).toBe('2025-01-15')
      expect(fields[5]).toBe('Groceries')
      // Recurrence fields should be empty
      expect(fields[6]).toBe('')
      expect(fields[7]).toBe('')
      expect(fields[8]).toBe('')
      expect(fields[9]).toBe('')
      expect(fields[10]).toBe('')
      expect(fields[11]).toBe('')
      expect(fields.length).toBe(12)
    })

    it('should serialize a recurring transaction', () => {
      const transaction: Transaction = {
        id: 'tx-1',
        userId: 'user-1',
        fromAccountId: 'acc-1',
        toAccountId: 'acc-1',
        amount: 2800,
        date: LogicalDate.fromString('2025-01-20'),
        description: 'Paycheck',
        recurrence: {
          frequency: 'weekly',
          interval: 2,
        },
      }
      
      const result = serializeTransactionToTSV(transaction)
      const fields = result.split('\t')
      
      expect(fields[0]).toBe('tx-1') // Transaction ID
      expect(fields[1]).toBe('recurring')
      expect(fields[2]).toBe('acc-1') // Account ID
      expect(fields[3]).toBe('2800')
      expect(fields[4]).toBe('2025-01-20')
      expect(fields[5]).toBe('Paycheck')
      expect(fields[6]).toBe('weekly')
      expect(fields[7]).toBe('2')
      expect(fields[8]).toBe('')
      expect(fields[9]).toBe('')
      expect(fields[10]).toBe('-1')
      expect(fields[11]).toBe('-1')
      expect(fields.length).toBe(12)
    })

    it('should serialize a recurring transaction with all fields', () => {
      const transaction: Transaction = {
        id: 'tx-1',
        userId: 'user-1',
        fromAccountId: 'acc-1',
        toAccountId: 'acc-1',
        amount: -1800,
        date: LogicalDate.fromString('2025-02-01'),
        description: 'Rent',
        recurrence: {
          frequency: 'monthly',
          interval: 1,
          dayOfMonth: 1,
          endDate: LogicalDate.fromString('2025-12-31'),
        },
      }
      
      const result = serializeTransactionToTSV(transaction)
      const fields = result.split('\t')
      
      expect(fields[0]).toBe('tx-1') // Transaction ID
      expect(fields[1]).toBe('recurring')
      expect(fields[2]).toBe('acc-1') // Account ID
      expect(fields[6]).toBe('monthly')
      expect(fields[7]).toBe('1')
      expect(fields[8]).toBe('')
      expect(fields[9]).toBe('1')
      expect(fields[10]).toBe('2025-12-31')
      expect(fields[11]).toBe('')
    })

    it('should serialize transaction without ID (for new transactions)', () => {
      const transaction: Omit<Transaction, 'id'> = {
        userId: 'user-1',
        fromAccountId: 'acc-1',
        toAccountId: 'acc-1',
        amount: -50,
        date: LogicalDate.fromString('2025-01-15'),
      }
      
      const result = serializeTransactionToTSV(transaction as Transaction)
      const fields = result.split('\t')
      
      expect(fields[0]).toBe('') // Empty ID for new transactions
      expect(fields[2]).toBe('acc-1') // Account ID
    })

    it('should handle optional fields', () => {
      const transaction: Transaction = {
        id: 'tx-1',
        userId: 'user-1',
        fromAccountId: 'acc-1',
        toAccountId: 'acc-1',
        amount: 100,
        date: LogicalDate.fromString('2025-01-15'),
        // No description or settlementDays
      }
      
      const result = serializeTransactionToTSV(transaction)
      const fields = result.split('\t')
      
      expect(fields[5]).toBe('') // Empty description
    })
  })

  describe('serializeTransactionsToTSV', () => {
    it('should serialize multiple transactions with header', () => {
      const transactions: Transaction[] = [
        {
          id: 'tx-1',
          userId: 'user-1',
          fromAccountId: 'acc-1',
          toAccountId: 'acc-1',
          amount: -50,
          date: LogicalDate.fromString('2025-01-15'),
          description: 'Groceries',
        },
        {
          id: 'tx-2',
          userId: 'user-1',
          fromAccountId: 'acc-3',
          toAccountId: 'acc-3',
          amount: 2800,
          date: LogicalDate.fromString('2025-01-20'),
          description: 'Paycheck',
          recurrence: {
            frequency: 'weekly',
            interval: 2,
          },
        },
      ]
      
      const result = serializeTransactionsToTSV(transactions)
      const lines = result.split('\n')
      
      expect(lines[0]).toBe(TSV_HEADER)
      expect(lines.length).toBe(3) // Header + 2 transactions
      
      const row1Fields = lines[1].split('\t')
      expect(row1Fields[0]).toBe('tx-1') // Transaction ID
      expect(row1Fields[1]).toBe('one-time')
      expect(row1Fields[2]).toBe('acc-1') // Account ID
      
      const row2Fields = lines[2].split('\t')
      expect(row2Fields[0]).toBe('tx-2') // Transaction ID
      expect(row2Fields[1]).toBe('recurring')
      expect(row2Fields[2]).toBe('acc-3') // Account ID
    })

    it('should handle empty transaction list', () => {
      const result = serializeTransactionsToTSV([])
      const lines = result.split('\n')
      
      expect(lines.length).toBe(1)
      expect(lines[0]).toBe(TSV_HEADER)
    })
  })

  describe('parseTSVRow', () => {
    it('should parse a valid one-time transaction row', () => {
      const row = 'tx-1\tone-time\tacc-1\t-50\t2025-01-15\tGroceries\t\t\t\t\t'
      const result = parseTSVRow(row, 2)
      
      expect(result.error).toBeNull()
      expect(result.row).toBeDefined()
      expect(result.row?.id).toBe('tx-1')
      expect(result.row?.type).toBe('one-time')
      expect(result.row?.accountId).toBe('acc-1')
      expect(result.row?.amount).toBe(-50)
      expect(result.row?.date.toString()).toBe('2025-01-15')
      expect(result.row?.description).toBe('Groceries')
      expect(result.row?.frequency).toBeUndefined()
    })

    it('should parse a valid recurring transaction row', () => {
      const row = 'tx-1\trecurring\tacc-1\t2800\t2025-01-20\tPaycheck\tweekly\t2\t\t\t-1\t-1'
      const result = parseTSVRow(row, 2)
      
      expect(result.error).toBeNull()
      expect(result.row).toBeDefined()
      expect(result.row?.id).toBe('tx-1')
      expect(result.row?.type).toBe('recurring')
      expect(result.row?.accountId).toBe('acc-1')
      expect(result.row?.frequency).toBe('weekly')
      expect(result.row?.interval).toBe(2)
      expect(result.row?.endDate).toBeUndefined()
      expect(result.row?.occurrences).toBeUndefined()
    })

    it('should parse a recurring transaction with all fields', () => {
      const row = 'tx-1\trecurring\tacc-1\t-1800\t2025-02-01\tRent\tmonthly\t1\t\t1\t2025-12-31\t'
      const result = parseTSVRow(row, 2)
      
      expect(result.error).toBeNull()
      expect(result.row).toBeDefined()
      expect(result.row?.id).toBe('tx-1')
      expect(result.row?.frequency).toBe('monthly')
      expect(result.row?.interval).toBe(1)
      expect(result.row?.dayOfMonth).toBe(1)
      expect(result.row?.endDate?.toString()).toBe('2025-12-31')
    })

    it('should reject invalid type', () => {
      const row = 'invalid-type\tMain Checking\tExpenses\t-50\t2025-01-15\tGroceries\t0\t\t\t\t\t'
      const result = parseTSVRow(row, 2)
      
      expect(result.row).toBeNull()
      expect(result.error).toBeDefined()
      expect(result.error?.message).toContain('Invalid type')
    })

    it('should reject invalid amount', () => {
      const row = '\tone-time\tacc-1\tnot-a-number\t2025-01-15\tGroceries\t\t\t\t\t'
      const result = parseTSVRow(row, 2)
      
      expect(result.row).toBeNull()
      expect(result.error).toBeDefined()
      expect(result.error?.message).toContain('Invalid amount')
    })

    it('should reject invalid date', () => {
      const row = '\tone-time\tacc-1\t-50\tinvalid-date\tGroceries\t0\t\t\t\t\t'
      const result = parseTSVRow(row, 2)
      
      expect(result.row).toBeNull()
      expect(result.error).toBeDefined()
      expect(result.error?.message).toContain('Invalid date')
    })

    it('should reject invalid frequency', () => {
      const row = '\trecurring\tacc-1\t2800\t2025-01-20\tPaycheck\t\tinvalid-frequency\t2\t\t\t-1\t-1'
      const result = parseTSVRow(row, 2)
      
      expect(result.row).toBeNull()
      expect(result.error).toBeDefined()
      expect(result.error?.message).toContain('Invalid frequency')
    })

    it('should reject invalid day of week', () => {
      const row = '\trecurring\tacc-1\t2800\t2025-01-20\tPaycheck\tweekly\t2\t8\t\t-1\t-1'
      const result = parseTSVRow(row, 2)
      
      expect(result.row).toBeNull()
      expect(result.error).toBeDefined()
      expect(result.error?.message).toContain('Invalid day of week')
    })

    it('should reject invalid day of month', () => {
      const row = '\trecurring\tacc-1\t-1800\t2025-02-01\tRent\tmonthly\t1\t\t32\t2025-12-31\t'
      const result = parseTSVRow(row, 2)
      
      expect(result.row).toBeNull()
      expect(result.error).toBeDefined()
      expect(result.error?.message).toContain('Invalid day of month')
    })

    it('should handle missing optional fields', () => {
      const row = '\tone-time\tacc-1\t-50\t2025-01-15\t\t\t\t\t\t'
      const result = parseTSVRow(row, 2)
      
      expect(result.error).toBeNull()
      expect(result.row).toBeDefined()
      expect(result.row?.id).toBeUndefined() // No ID for new transaction
      expect(result.row?.description).toBeUndefined()
    })

    it('should pad fields to 12 columns', () => {
      const row = '\tone-time\tacc-1\t-50\t2025-01-15\tGroceries'
      const result = parseTSVRow(row, 2)
      
      // Should still parse successfully with padding
      expect(result.error).toBeNull()
      expect(result.row).toBeDefined()
    })
  })

  describe('parseTSV', () => {
    it('should parse a valid TSV with multiple transactions', () => {
      const tsv = `${TSV_HEADER}
tx-1\tone-time\tacc-1\t-50\t2025-01-15\tGroceries\t\t\t\t\t
tx-2\trecurring\tacc-2\t2800\t2025-01-20\tPaycheck\tweekly\t2\t\t\t-1\t-1`
      
      const result = parseTSV(tsv)
      
      expect(result.errors.length).toBe(0)
      expect(result.rows.length).toBe(2)
      expect(result.rows[0].id).toBe('tx-1')
      expect(result.rows[0].type).toBe('one-time')
      expect(result.rows[1].id).toBe('tx-2')
      expect(result.rows[1].type).toBe('recurring')
    })

    it('should reject TSV with invalid header', () => {
      const tsv = `Invalid Header
one-time\tMain Checking\tExpenses\t-50\t2025-01-15\tGroceries\t0\t\t\t\t\t`
      
      const result = parseTSV(tsv)
      
      expect(result.rows.length).toBe(0)
      expect(result.errors.length).toBe(1)
      expect(result.errors[0].message).toContain('Invalid header')
    })

    it('should reject TSV with no data rows', () => {
      const tsv = TSV_HEADER
      
      const result = parseTSV(tsv)
      
      expect(result.rows.length).toBe(0)
      expect(result.errors.length).toBe(1)
      expect(result.errors[0].message).toContain('No data rows')
    })

    it('should collect all validation errors', () => {
      const tsv = `${TSV_HEADER}
\tinvalid-type\tacc-1\t-50\t2025-01-15\tGroceries\t0\t\t\t\t\t
\tone-time\tacc-1\tnot-a-number\t2025-01-15\tGroceries\t0\t\t\t\t\t
\tone-time\tacc-1\t-50\tinvalid-date\tGroceries\t0\t\t\t\t\t`
      
      const result = parseTSV(tsv)
      
      expect(result.errors.length).toBe(3)
      expect(result.rows.length).toBe(0)
    })

    it('should handle empty TSV', () => {
      const result = parseTSV('')
      
      expect(result.rows.length).toBe(0)
      expect(result.errors.length).toBe(1)
      expect(result.errors[0].message).toContain('No data rows')
    })
  })

  describe('tsvRowToTransaction', () => {
    it('should convert a valid TSV row to transaction', () => {
      const tsvRow = {
        id: 'tx-1',
        type: 'one-time' as const,
        accountId: 'acc-1',
        amount: -50,
        date: LogicalDate.fromString('2025-01-15'),
        description: 'Groceries',
        settlementDays: 0,
      }
      
      const result = tsvRowToTransaction(tsvRow)
      
      expect(result.error).toBeNull()
      expect(result.transaction).toBeDefined()
      expect('id' in result.transaction && result.transaction.id).toBe('tx-1')
      expect(result.transaction?.fromAccountId).toBe('acc-1')
      expect(result.transaction?.toAccountId).toBe('acc-1') // Same account for both
      expect(result.transaction?.amount).toBe(-50)
      expect(result.transaction?.description).toBe('Groceries')
      expect(result.transaction?.recurrence).toBeUndefined()
    })

    it('should convert a recurring TSV row to transaction', () => {
      const tsvRow = {
        id: 'tx-1',
        type: 'recurring' as const,
        accountId: 'acc-3',
        amount: 2800,
        date: LogicalDate.fromString('2025-01-20'),
        description: 'Paycheck',
        frequency: 'weekly' as const,
        interval: 2,
      }
      
      const result = tsvRowToTransaction(tsvRow)
      
      expect(result.error).toBeNull()
      expect(result.transaction).toBeDefined()
      expect('id' in result.transaction && result.transaction.id).toBe('tx-1')
      expect(result.transaction?.fromAccountId).toBe('acc-3')
      expect(result.transaction?.toAccountId).toBe('acc-3') // Same account for both
      expect(result.transaction?.recurrence).toBeDefined()
      expect(result.transaction?.recurrence?.frequency).toBe('weekly')
      expect(result.transaction?.recurrence?.interval).toBe(2)
    })

    it('should convert transaction without ID (for new transactions)', () => {
      const tsvRow = {
        type: 'one-time' as const,
        accountId: 'acc-1',
        amount: -50,
        date: LogicalDate.fromString('2025-01-15'),
      }
      
      const result = tsvRowToTransaction(tsvRow)
      
      expect(result.error).toBeNull()
      expect(result.transaction).toBeDefined()
      expect('id' in result.transaction).toBe(false) // No ID for new transaction
      expect(result.transaction?.fromAccountId).toBe('acc-1')
    })
  })

  describe('Round-trip serialization', () => {
    it('should serialize and parse a one-time transaction', () => {
      const originalTransaction: Transaction = {
        id: 'tx-1',
        userId: 'user-1',
        fromAccountId: 'acc-1',
        toAccountId: 'acc-2',
        amount: -50,
        date: LogicalDate.fromString('2025-01-15'),
        description: 'Groceries',
        settlementDays: 0,
      }
      
      // Serialize
      const tsvRow = serializeTransactionToTSV(originalTransaction)
      
      // Parse
      const parseResult = parseTSVRow(tsvRow, 2)
      expect(parseResult.error).toBeNull()
      expect(parseResult.row).toBeDefined()
      
      // Convert to transaction
      const transactionResult = tsvRowToTransaction(parseResult.row!)
      expect(transactionResult.error).toBeNull()
      expect(transactionResult.transaction).toBeDefined()
      
      // Verify fields match
      const parsed = transactionResult.transaction!
      if ('id' in parsed) {
        expect(parsed.id).toBe(originalTransaction.id)
      }
      expect(parsed.fromAccountId).toBe(originalTransaction.fromAccountId)
      expect(parsed.toAccountId).toBe(originalTransaction.fromAccountId) // Will be same as fromAccountId
      expect(parsed.amount).toBe(originalTransaction.amount)
      expect(parsed.date.toString()).toBe(originalTransaction.date.toString())
      expect(parsed.description).toBe(originalTransaction.description)
      // Note: settlementDays is not serialized in TSV format
    })

    it('should serialize and parse a recurring transaction', () => {
      const originalTransaction: Transaction = {
        id: 'tx-1',
        userId: 'user-1',
        fromAccountId: 'acc-3',
        toAccountId: 'acc-1',
        amount: 2800,
        date: LogicalDate.fromString('2025-01-20'),
        description: 'Paycheck',
        recurrence: {
          frequency: 'weekly',
          interval: 2,
        },
      }
      
      // Serialize
      const tsvRow = serializeTransactionToTSV(originalTransaction)
      
      // Parse
      const parseResult = parseTSVRow(tsvRow, 2)
      expect(parseResult.error).toBeNull()
      
      // Convert to transaction
      const transactionResult = tsvRowToTransaction(parseResult.row!)
      expect(transactionResult.error).toBeNull()
      
      // Verify recurrence matches
      const parsed = transactionResult.transaction!
      expect(parsed.recurrence?.frequency).toBe(originalTransaction.recurrence?.frequency)
      expect(parsed.recurrence?.interval).toBe(originalTransaction.recurrence?.interval)
    })
  })
})

