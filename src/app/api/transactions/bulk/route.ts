import { NextRequest, NextResponse } from 'next/server'
import { dataAdapter } from '@/lib/prisma-adapter'
import type { Transaction } from '@/lib/data-adapter'
import {
  serializeTransactionsToTSV,
  parseTSV,
  tsvRowToTransaction,
  TSV_HEADER,
} from '@/lib/tsv-transactions'

const getCurrentUserId = () => 'user-1' // TODO: Replace with actual auth


/**
 * Export transactions as TSV
 */
export async function GET(request: NextRequest) {
  try {
    const userId = getCurrentUserId()
    
    // Get all transactions
    const transactions = await dataAdapter.getTransactions(userId)
    
    // Serialize transactions to TSV (includes IDs and account IDs)
    const tsv = serializeTransactionsToTSV(transactions)
    
    return new NextResponse(tsv, {
      status: 200,
      headers: {
        'Content-Type': 'text/tab-separated-values',
        'Content-Disposition': 'attachment; filename="transactions.tsv"',
      },
    })
  } catch (error) {
    console.error('Error exporting transactions:', error)
    return NextResponse.json({ error: 'Failed to export transactions' }, { status: 500 })
  }
}

/**
 * Import transactions from TSV
 */
export async function POST(request: NextRequest) {
  try {
    const userId = getCurrentUserId()
    const tsv = await request.text()
    
    if (!tsv.trim()) {
      return NextResponse.json({ error: 'Empty TSV data' }, { status: 400 })
    }
    
    // Parse TSV using utility function
    const parseResult = parseTSV(tsv)
    
    if (parseResult.errors.length > 0) {
      return NextResponse.json({ 
        error: 'Validation errors',
        errors: parseResult.errors.map(e => `Row ${e.row}: ${e.message}`),
        transactionsCreated: 0,
        transactionsUpdated: 0,
      }, { status: 400 })
    }
    
    // Get all accounts to validate account IDs
    const accounts = await dataAdapter.getAccounts(userId)
    const accountIds = new Set(accounts.map(acc => acc.id))
    
    // Convert TSV rows to transactions
    const errors: string[] = []
    const transactionsToCreate: Omit<Transaction, 'id' | 'userId'>[] = []
    const transactionsToUpdate: Transaction[] = []
    
    for (let i = 0; i < parseResult.rows.length; i++) {
      const tsvRow = parseResult.rows[i]
      
      // Validate account ID exists
      if (!accountIds.has(tsvRow.accountId)) {
        errors.push(`Row ${i + 2}: Account ID "${tsvRow.accountId}" not found`)
        continue
      }
      
      const result = tsvRowToTransaction(tsvRow)
      if (result.error) {
        errors.push(`Row ${i + 2}: ${result.error.message}`) // +2 because row 1 is header, and arrays are 0-indexed
        continue
      }
      if (result.transaction) {
        if ('id' in result.transaction && result.transaction.id) {
          // Has ID - update existing transaction
          transactionsToUpdate.push(result.transaction as Transaction)
        } else {
          // No ID - create new transaction
          transactionsToCreate.push(result.transaction as Omit<Transaction, 'id' | 'userId'>)
        }
      }
    }
    
    // If there are errors, return them
    if (errors.length > 0) {
      return NextResponse.json({ 
        error: 'Validation errors',
        errors,
        transactionsCreated: 0,
        transactionsUpdated: 0,
      }, { status: 400 })
    }
    
    // Update existing transactions
    const updated = []
    for (const tx of transactionsToUpdate) {
      try {
        // Extract ID and create update payload without it
        const { id, userId: _, ...updatePayload } = tx
        const updatedTx = await dataAdapter.updateTransaction(userId, id, updatePayload)
        updated.push(updatedTx)
      } catch (error) {
        errors.push(`Failed to update transaction ${tx.id}: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
    
    // Create new transactions
    const created = []
    for (const tx of transactionsToCreate) {
      try {
        const createdTx = await dataAdapter.createTransaction(userId, tx)
        created.push(createdTx)
      } catch (error) {
        errors.push(`Failed to create transaction: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
    
    if (errors.length > 0) {
      return NextResponse.json({ 
        error: 'Some transactions failed to process',
        errors,
        transactionsCreated: created.length,
        transactionsUpdated: updated.length,
      }, { status: 500 })
    }
    
    // Convert LogicalDate objects to strings for response
    const createdResponse = created.map(tx => ({
      ...tx,
      date: tx.date.toString(),
      ...(tx.recurrence?.endDate && {
        recurrence: {
          ...tx.recurrence,
          endDate: tx.recurrence.endDate.toString(),
        },
      }),
    }))
    
    const updatedResponse = updated.map(tx => ({
      ...tx,
      date: tx.date.toString(),
      ...(tx.recurrence?.endDate && {
        recurrence: {
          ...tx.recurrence,
          endDate: tx.recurrence.endDate.toString(),
        },
      }),
    }))
    
    return NextResponse.json({ 
      message: `Successfully imported ${created.length + updated.length} transaction(s) (${created.length} created, ${updated.length} updated)`,
      transactions: [...createdResponse, ...updatedResponse],
      created: createdResponse,
      updated: updatedResponse,
    }, { status: 201 })
  } catch (error) {
    console.error('Error importing transactions:', error)
    return NextResponse.json({ 
      error: 'Failed to import transactions',
      message: error instanceof Error ? error.message : String(error),
    }, { status: 500 })
  }
}

